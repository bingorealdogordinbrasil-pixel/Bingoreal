const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// --- SERVIR FRONT-END ---
// Resolve o erro "Cannot GET /" servindo o seu index.html
app.use(express.static(path.join(__dirname, '/')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- MERCADO PAGO ---
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-2683158167668377-123121-4666c74759e0eac123b8c4c23bf7c1f1-485513741' 
});
const payment = new Payment(client);

// --- BANCO DE DADOS ---
const mongoURI = "mongodb+srv://admin:bingoreal123@cluster0.ap7q4ev.mongodb.net/?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("Bingo Real Conectado!"));

const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// ESTADO DO JOGO
let jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300 };

// MOTOR DO BINGO (Sorteio a cada 10s após o tempo acabar)
setInterval(() => {
    if (jogo.tempoSegundos > 0) {
        jogo.tempoSegundos--;
        jogo.fase = "acumulando";
    } else {
        jogo.fase = "sorteio";
        if (jogo.bolas.length < 50 && (Math.abs(jogo.tempoSegundos) % 10 === 0)) {
            let bola;
            do { bola = Math.floor(Math.random() * 50) + 1; } while (jogo.bolas.includes(bola));
            jogo.bolas.push(bola);
        }
        jogo.tempoSegundos--; 
    }
}, 1000);

// --- ROTA GERAÇÃO DE PIX ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    if (!valor || valor < 10) return res.status(400).json({ message: "Mínimo R$ 10" });

    try {
        const response = await payment.create({
            body: {
                transaction_amount: parseFloat(valor),
                description: `Depósito Bingo - ID ${userId}`,
                payment_method_id: 'pix',
                payer: { email: 'cliente@bingoreal.com' },
                external_reference: userId
            }
        });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) { res.status(500).json({ message: "Erro ao gerar PIX" }); }
});

// --- WEBHOOK PARA SALDO AUTOMÁTICO ---
app.post('/webhook', async (req, res) => {
    const { action, data } = req.body;
    if (action === "payment.updated") {
        try {
            const p = await payment.get({ id: data.id });
            if (p.status === "approved") {
                await User.findByIdAndUpdate(p.external_reference, { $inc: { saldo: p.transaction_amount } });
                console.log(`Saldo creditado: ${p.transaction_amount} para ID: ${p.external_reference}`);
            }
        } catch (e) { console.error("Erro Webhook:", e); }
    }
    res.sendStatus(200);
});

// --- ROTAS API ---
app.get('/game-status', (req, res) => res.json(jogo));

app.get('/user-data/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (e) { res.status(404).send(); }
});

app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    const user = await User.findById(usuarioId);
    const custo = quantidade * 2;
    if (user && user.saldo >= custo && jogo.fase === "acumulando") {
        let novas = [];
        for (let i = 0; i < quantidade; i++) {
            let n = [];
            while(n.length < 15) { 
                let num = Math.floor(Math.random() * 50) + 1; 
                if(!n.includes(num)) n.push(num); 
            }
            novas.push(n.sort((a,b) => a - b));
        }
        await User.findByIdAndUpdate(usuarioId, { $inc: { saldo: -custo }, $push: { cartelas: { $each: novas } } });
        jogo.premioAcumulado += (custo * 0.7);
        res.json({ success: true });
    } else res.status(400).send({ message: "Saldo insuficiente ou sorteio em curso" });
});

app.post('/register', async (req, res) => {
    try { const u = new User(req.body); await u.save(); res.status(201).json(u); }
    catch (e) { res.status(400).json({ message: "Erro no registro" }); }
});

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json(u); else res.status(401).send({ message: "Dados incorretos" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor Bingo rodando na porta ${PORT}`));
