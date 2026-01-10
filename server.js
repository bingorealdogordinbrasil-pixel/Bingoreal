const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

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
    name: String, 
    email: { type: String, unique: true }, 
    senha: String,
    saldo: { type: Number, default: 0 }, 
    cartelas: { type: Array, default: [] }
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

// --- ROTAS DO JOGO ---
app.get('/game-status', (req, res) => res.json(jogo));

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    u ? res.json(u) : res.status(401).send();
});

app.post('/register', async (req, res) => {
    try { const u = new User(req.body); await u.save(); res.json(u); } catch(e) { res.status(400).send(); }
});

app.get('/user-data/:id', async (req, res) => {
    try { const u = await User.findById(req.params.id); res.json(u); } catch (e) { res.status(404).send(); }
});

app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
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
        await User.findByIdAndUpdate(usuarioId, { $inc: { saldo: -custo }, $push: { cartelas: { $each: novas } } });
        jogo.premioAcumulado += (custo * 0.25);
        jogo.totalVendasRodada += custo;
        res.json({ success: true });
    } else res.status(400).send();
});

// --- PIX ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    try {
        const response = await payment.create({
            body: {
                transaction_amount: parseFloat(valor),
                description: `Bingo Real`,
                payment_method_id: 'pix',
                payer: { email: 'contato@bingoreal.com' },
                external_reference: userId
            }
        });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) { res.status(500).send(); }
});

app.post('/webhook', async (req, res) => {
    const { action, data } = req.body;
    if (action === "payment.updated") {
        try {
            const p = await payment.get({ id: data.id });
            if (p.status === "approved") {
                await User.findByIdAndUpdate(p.external_reference, { $inc: { saldo: p.transaction_amount } });
            }
        } catch (e) {}
    }
    res.sendStatus(200);
});

// --- GERENTE (ADMIN) ---
app.post('/admin/dashboard', async (req, res) => {
    if (req.body.senha !== SENHA_ADMIN) return res.status(401).send();
    const jogadores = await User.find({}, 'name email saldo _id');
    const saques = await Withdrawal.find().sort({ data: -1 });
    res.json({ 
        jogadores, 
        saques, 
        lucroRodada: jogo.totalVendasRodada - jogo.premioAcumulado 
    });
});

app.post('/admin/dar-bonus', async (req, res) => {
    const { senha, userId, valor } = req.body;
    if (senha !== SENHA_ADMIN) return res.status(401).send();
    try {
        const u = await User.findByIdAndUpdate(userId, { $inc: { saldo: parseFloat(valor) } }, { new: true });
        res.json({ success: true, novoSaldo: u.saldo });
    } catch (e) { res.status(400).send(); }
});

app.post('/admin/finalizar-saque', async (req, res) => {
    if (req.body.senha !== SENHA_ADMIN) return res.status(401).send();
    await Withdrawal.findByIdAndDelete(req.body.saqueId);
    res.json({ success: true });
});

app.post('/solicitar-saque', async (req, res) => {
    const { userId, valor, chavePix } = req.body;
    const v = parseFloat(valor);
    try {
        const user = await User.findById(userId);
        if (user && user.saldo >= v && v >= 20) {
            await User.findByIdAndUpdate(userId, { $inc: { saldo: -v } });
            const pedido = new Withdrawal({ userId: user._id, userName: user.name, valor: v, chavePix: chavePix });
            await pedido.save();
            res.json({ success: true });
        } else res.status(400).json({ error: "Saldo insuficiente" });
    } catch (e) { res.status(500).send(); }
});

app.listen(process.env.PORT || 10000);
         
