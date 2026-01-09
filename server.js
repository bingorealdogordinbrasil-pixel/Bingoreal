const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// --- SERVIR FRONT-END (Corrige o erro "Cannot GET /") ---
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

// ESTADO DO JOGO (Tempo sincronizado)
let jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300 };

// --- MOTOR DO BINGO (O cronômetro que você pediu) ---
setInterval(() => {
    if (jogo.tempoSegundos > 0) {
        jogo.tempoSegundos--; // Diminui o tempo globalmente a cada segundo
        jogo.fase = "acumulando";
    } else {
        jogo.fase = "sorteio";
        // Sorteia uma bola a cada 10 segundos
        if (jogo.bolas.length < 50 && (Math.abs(jogo.tempoSegundos) % 10 === 0)) {
            sortearBolaAutomatica();
        }
        jogo.tempoSegundos--; 
    }
}, 1000);

function sortearBolaAutomatica() {
    if (jogo.bolas.length >= 50) return;
    let bola;
    do { bola = Math.floor(Math.random() * 50) + 1; } while (jogo.bolas.includes(bola));
    jogo.bolas.push(bola);
}

// --- ROTAS PIX E WEBHOOK ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
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
    } catch (e) { res.status(500).json({ message: "Erro Pix" }); }
});

app.post('/webhook', async (req, res) => {
    const { action, data } = req.body;
    if (action === "payment.updated") {
        try {
            const p = await payment.get({ id: data.id });
            if (p.status === "approved") {
                await User.findByIdAndUpdate(p.external_reference, { $inc: { saldo: p.transaction_amount } });
            }
        } catch (e) { console.error(e); }
    }
    res.sendStatus(200);
});

// --- ROTAS API ---
app.get('/game-status', (req, res) => res.json(jogo));
app.get('/user-data/:id', async (req, res) => {
    const user = await User.findById(req.params.id);
    res.json(user);
});

app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    const user = await User.findById(usuarioId);
    const custo = quantidade * 2;
    if (user && user.saldo >= custo && jogo.fase === "acumulando") {
        let novas = [];
        for (let i = 0; i < quantidade; i++) {
            let n = [];
            while(n.length < 15) { let num = Math.floor(Math.random()*50)+1; if(!n.includes(num)) n.push(num); }
            novas.push(n.sort((a,b)=>a-b));
        }
        await User.findByIdAndUpdate(usuarioId, { $inc: { saldo: -custo }, $push: { cartelas: { $each: novas } } });
        jogo.premioAcumulado += (custo * 0.7);
        res.json({ success: true });
    } else res.status(400).send();
});

app.post('/register', async (req, res) => {
    const u = new User(req.body); await u.save(); res.status(201).json(u);
});

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json(u); else res.status(401).send();
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor Bingo Online!"));
