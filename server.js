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

// --- MOTOR DO JOGO ---
let jogo = { 
    bolas: [], 
    fase: "acumulando", 
    premioAcumulado: 0, 
    tempoSegundos: 300, 
    ganhador: null,
    cartelaVencedora: null 
};

setInterval(async () => {
    if (jogo.fase === "acumulando") {
        if (jogo.tempoSegundos > 0) {
            jogo.tempoSegundos--;
        } else {
            jogo.fase = "sorteio";
        }
    } else if (jogo.fase === "sorteio") {
        if (Math.abs(jogo.tempoSegundos) % 3 === 0) {
            await realizarSorteio();
        }
        jogo.tempoSegundos--;
    } else if (jogo.fase === "finalizado") {
        if (Math.abs(jogo.tempoSegundos) % 15 === 0) {
            reiniciarGlobal();
        }
        jogo.tempoSegundos--;
    }
}, 1000);

async function realizarSorteio() {
    if (jogo.bolas.length >= 50 || jogo.fase !== "sorteio") return;

    let bola;
    do { 
        bola = Math.floor(Math.random() * 50) + 1; 
    } while (jogo.bolas.includes(bola));
    
    jogo.bolas.push(bola);

    const todosUsuarios = await User.find({ "cartelas.0": { $exists: true } });
    
    for (let u of todosUsuarios) {
        for (let c of u.cartelas) {
            const ganhou = c.every(num => jogo.bolas.includes(num));
            
            if (ganhou) {
                jogo.ganhador = u.name;
                jogo.cartelaVencedora = c; 
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
    jogo = { 
        bolas: [], 
        fase: "acumulando", 
        premioAcumulado: 0, 
        tempoSegundos: 300, 
        ganhador: null,
        cartelaVencedora: null 
    };
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
    try {
        const u = await User.findById(req.params.id);
        res.json(u);
    } catch (e) { res.status(404).send(); }
});

// --- ROTA CORRIGIDA COM A REGRA DOS 25% ---
app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    const user = await User.findById(usuarioId);
    const custo = parseInt(quantidade) * 2; // Custo de 2 reais por cartela
    
    if (user && user.saldo >= custo && jogo.fase === "acumulando") {
        let novas = [];
        for (let i = 0; i < quantidade; i++) {
            let n = [];
            while(n.length < 15) { 
                let num = Math.floor(Math.random()*50)+1; 
                if(!n.includes(num)) n.push(num); 
            }
            novas.push(n.sort((a,b)=>a-b));
        }
        await User.findByIdAndUpdate(usuarioId, { $inc: { saldo: -custo }, $push: { cartelas: { $each: novas } } });
        
        // AQUI ESTÁ A CORREÇÃO: 25% de 2,00 é 0,50. 
        // Se custo é 2, 2 * 0.25 = 0,50. Se comprar 10 cartelas (20 reais), 20 * 0.25 = 5 reais para o prêmio.
        jogo.premioAcumulado += (custo * 0.25); 

        res.json({ success: true });
    } else res.status(400).json({ error: "Saldo insuficiente ou fase incorreta" });
});

// --- ROTAS ADMINISTRATIVAS ---
app.get('/admin/users', async (req, res) => {
    try {
        const users = await User.find({}, 'name saldo _id').sort({ name: 1 });
        res.json(users);
    } catch (e) { res.status(500).send(); }
});

app.post('/adicionar-saldo-manual', async (req, res) => {
    const { userId, valor } = req.body;
    try {
        const user = await User.findByIdAndUpdate(userId, { $inc: { saldo: parseFloat(valor) } }, { new: true });
        if (user) res.json({ success: true, novoSaldo: user.saldo });
        else res.status(404).json({ message: "Usuário não encontrado" });
    } catch (e) { res.status(500).json({ message: "Erro ao processar ID" }); }
});

app.post('/reset-game', (req, res) => {
    reiniciarGlobal();
    res.json({ success: true });
});

// --- PAGAMENTOS ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    try {
        const response = await payment.create({
            body: {
                transaction_amount: parseFloat(valor),
                description: `Crédito Bingo`,
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
        } catch (e) { console.error("Erro webhook"); }
    }
    res.sendStatus(200);
});

app.listen(process.env.PORT || 10000);
