const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt'); // Criptografia de senhas
const helmet = require('helmet'); // Proteção de cabeçalhos HTTP
const rateLimit = require('express-rate-limit'); // Prevenção contra robôs/ataques
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();

// --- 🛡️ CAMADA DE SEGURANÇA 1: BLINDAGEM DO SERVIDOR ---
app.use(helmet({
  contentSecurityPolicy: false, // Permite carregar recursos externos se necessário
}));
app.use(cors());
app.use(express.json());

// Limita o número de requisições por IP para evitar ataques de negação de serviço (DoS)
const geralLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // Limite de 100 requisições por IP
});
app.use(geralLimiter);

app.use(express.static(path.join(__dirname, '/')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- CONFIGURAÇÃO ---
const SENHA_ADMIN = "bingo2026"; 

// --- MERCADO PAGO ---
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-2683158167668377-123121-4666c74759e0eac123b8c4c23bf7c1f1-485513741' 
});
const payment = new Payment(client);

// --- BANCO DE DADOS ---
const mongoURI = "mongodb+srv://admin:bingoreal123@cluster0.ap7q4ev.mongodb.net/?retryWrites=true&w=majority";
mongoose.connect(mongoURI);

const User = mongoose.model('User', new mongoose.Schema({
    name: { type: String, required: true }, 
    email: { type: String, unique: true, required: true }, 
    senha: { type: String, required: true },
    saldo: { type: Number, default: 0 }, 
    cartelas: { type: Array, default: [] },
    totalApostado: { type: Number, default: 0 },
    totalRecebido: { type: Number, default: 0 }
}));

const Withdrawal = mongoose.model('Withdrawal', new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    valor: Number,
    chavePix: String,
    status: { type: String, default: 'pendente' },
    data: { type: Date, default: Date.now }
}));

// --- MOTOR DO JOGO ---
let jogo = { 
    bolas: [], 
    fase: "acumulando", 
    premioAcumulado: 0, 
    tempoSegundos: 300, 
    ganhador: null,
    valorGanho: 0,
    totalVendasRodada: 0 
};

setInterval(async () => {
    if (jogo.fase === "acumulando") {
        if (jogo.tempoSegundos > 0) jogo.tempoSegundos--;
        else jogo.fase = "sorteio";
    } else if (jogo.fase === "sorteio") {
        if (Math.abs(jogo.tempoSegundos) % 3 === 0) await realizarSorteio();
        jogo.tempoSegundos--;
    } else if (jogo.fase === "finalizado") {
        if (Math.abs(jogo.tempoSegundos) >= 15) reiniciarGlobal();
        jogo.tempoSegundos++;
    }
}, 1000);

async function realizarSorteio() {
    if (jogo.bolas.length >= 50 || jogo.fase !== "sorteio") return;
    let bola;
    do { bola = Math.floor(Math.random() * 50) + 1; } while (jogo.bolas.includes(bola));
    jogo.bolas.push(bola);
    const todosUsuarios = await User.find({ "cartelas.0": { $exists: true } });
    for (let u of todosUsuarios) {
        for (let c of u.cartelas) {
            if (c.every(num => jogo.bolas.includes(num))) {
                jogo.ganhador = u.name;
                jogo.valorGanho = jogo.premioAcumulado;
                jogo.fase = "finalizado";
                jogo.tempoSegundos = 0;
                await User.findByIdAndUpdate(u._id, { $inc: { saldo: jogo.premioAcumulado } });
                await User.updateMany({}, { $set: { cartelas: [] } });
                return;
            }
        }
    }
}

function reiniciarGlobal() {
    jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300, ganhador: null, valorGanho: 0, totalVendasRodada: 0 };
}

// --- 🛡️ ROTAS PROTEGIDAS ---

app.post('/register', async (req, res) => {
    try {
        const { name, email, senha } = req.body;
        // Criptografia da senha (Salt)
        const salt = await bcrypt.genSalt(10);
        const hashedSenha = await bcrypt.hash(senha, salt);
        
        const u = new User({ name, email, senha: hashedSenha });
        await u.save();
        res.json({ success: true });
    } catch(e) { 
        res.status(400).json({ error: "E-mail já cadastrado ou dados inválidos." }); 
    }
});

app.post('/login', async (req, res) => {
    try {
        const u = await User.findOne({ email: req.body.email });
        if (u && await bcrypt.compare(req.body.senha, u.senha)) {
            // Não envia a senha de volta para o cliente por segurança
            const { senha, ...userSemSenha } = u.toObject();
            res.json(userSemSenha);
        } else {
            res.status(401).json({ error: "Credenciais inválidas." });
        }
    } catch (e) { res.status(500).send(); }
});

app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    if (quantidade <= 0 || quantidade > 50) return res.status(400).json({ error: "Quantidade inválida." });

    const user = await User.findById(usuarioId);
    const custo = parseInt(quantidade) * 2;
    if (user && user.saldo >= custo && jogo.fase === "acumulando") {
        let novas = [];
        for (let i = 0; i < quantidade; i++) {
            let n = [];
            while(n.length < 8) {
                let num = Math.floor(Math.random()*50)+1;
                if(!n.includes(num)) n.push(num);
            }
            novas.push(n.sort((a,b)=>a-b));
        }
        await User.findByIdAndUpdate(usuarioId, { 
            $inc: { saldo: -custo, totalApostado: custo }, 
            $push: { cartelas: { $each: novas } } 
        });
        jogo.premioAcumulado += (custo * 0.25);
        jogo.totalVendasRodada += custo;
        res.json({ success: true });
    } else res.status(400).json({ error: "Saldo insuficiente ou fase inválida." });
});

app.post('/solicitar-saque', async (req, res) => {
    const { userId, valor, chavePix } = req.body;
    const v = parseFloat(valor);
    try {
        const user = await User.findById(userId);
        
        // 🛡️ TRAVA DE ROLLOVER: Só saca se jogou o que depositou/ganhou
        if (user && user.totalApostado < user.totalRecebido) {
            const falta = user.totalRecebido - user.totalApostado;
            return res.status(400).json({ 
                error: `Segurança: Você ainda precisa apostar R$ ${falta.toFixed(2)} para liberar o saque.` 
            });
        }

        if (user && user.saldo >= v && v >= 20) {
            await User.findByIdAndUpdate(userId, { $inc: { saldo: -v } });
            const pedido = new Withdrawal({ userId: user._id, userName: user.name, valor: v, chavePix: chavePix });
            await pedido.save();
            res.json({ success: true });
        } else res.status(400).json({ error: "Saldo insuficiente ou valor mínimo não atingido." });
    } catch (e) { res.status(500).send(); }
});

// --- GERENTE (ADMIN) ---
app.post('/admin/dashboard', async (req, res) => {
    if (req.body.senha !== SENHA_ADMIN) return res.status(401).send();
    const jogadores = await User.find({}, 'name email saldo totalApostado totalRecebido _id');
    const saques = await Withdrawal.find().sort({ data: -1 });
    const bancoJogadores = jogadores.reduce((acc, curr) => acc + curr.saldo, 0);
    res.json({ 
        jogadores, 
        saques, 
        lucroRodada: jogo.totalVendasRodada - jogo.premioAcumulado,
        bancoJogadores
    });
});

app.post('/admin/dar-bonus', async (req, res) => {
    if (req.body.senha !== SENHA_ADMIN) return res.status(401).send();
    try {
        const v = parseFloat(req.body.valor);
        await User.findByIdAndUpdate(req.body.userId, { $inc: { saldo: v, totalRecebido: v } });
        res.json({ success: true });
    } catch (e) { res.status(400).send(); }
});

app.listen(process.env.PORT || 10000);
