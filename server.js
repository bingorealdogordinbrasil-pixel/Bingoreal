const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO PARA SERVIR O FRONT-END ---
// Serve os arquivos estáticos (CSS, JS) e o index.html na raiz
app.use(express.static(path.join(__dirname, '/')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- CONFIGURAÇÃO MERCADO PAGO ---
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-2683158167668377-123121-4666c74759e0eac123b8c4c23bf7c1f1-485513741' 
});
const payment = new Payment(client);

// --- CONEXÃO COM O BANCO DE DADOS ---
const mongoURI = "mongodb+srv://admin:bingoreal123@cluster0.ap7q4ev.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(mongoURI).then(() => console.log("Servidor de Bingo Automático Online!"));

const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// ESTADO INICIAL DO JOGO
let jogo = {
    bolas: [],
    fase: "acumulando", 
    premioAcumulado: 0,
    tempoSegundos: 300 
};

// --- MOTOR AUTOMÁTICO DO BINGO ---
setInterval(() => {
    if (jogo.tempoSegundos > 0) {
        jogo.tempoSegundos--;
        jogo.fase = "acumulando";
    } else {
        jogo.fase = "sorteio";
        if (jogo.bolas.length < 50 && (Math.abs(jogo.tempoSegundos) % 10 === 0)) {
            sortearBolaAutomatica();
        }
        jogo.tempoSegundos--; 
    }
}, 1000);

function sortearBolaAutomatica() {
    let bola;
    if (jogo.bolas.length >= 50) return;
    do {
        bola = Math.floor(Math.random() * 50) + 1;
    } while (jogo.bolas.includes(bola));
    jogo.bolas.push(bola);
    console.log(`Bola sorteada automaticamente: ${bola}`);
}

// --- ROTA DE GERAÇÃO DE PIX REAL ---
app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;

    if (!valor || valor < 10) {
        return res.status(400).json({ message: "Mínimo R$ 10" });
    }

    const body = {
        transaction_amount: parseFloat(valor),
        description: `Depósito Bingo Real - ID: ${userId}`,
        payment_method_id: 'pix',
        payer: {
            email: 'cliente@bingoreal.com',
            first_name: 'Usuario',
            last_name: 'Bingo'
        },
        external_reference: userId // Identifica o usuário no webhook
    };

    try {
        const response = await payment.create({ body });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64,
            payment_id: response.id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erro ao gerar PIX" });
    }
});

// --- WEBHOOK PARA SALDO AUTOMÁTICO ---
app.post('/webhook', async (req, res) => {
    const { action, data } = req.body;

    if (action === "payment.updated") {
        try {
            const p = await payment.get({ id: data.id });
            if (p.status === "approved") {
                const userId = p.external_reference;
                const valorPago = p.transaction_amount;

                await User.findByIdAndUpdate(userId, { $inc: { saldo: valorPago } });
                console.log(`Saldo de R$ ${valorPago} creditado ao usuário ${userId}`);
            }
        } catch (e) {
            console.error("Erro no Webhook:", e);
        }
    }
    res.sendStatus(200);
});

// --- ROTAS DE JOGO E USUÁRIO ---
app.get('/game-status', (req, res) => res.json(jogo));

app.get('/user-data/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (e) { res.status(404).send(); }
});

app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    if (jogo.fase !== "acumulando") return res.status(400).json({ message: "Sorteio em andamento" });

    const precoTotal = quantidade * 2;
    const user = await User.findById(usuarioId);

    if (user && user.saldo >= precoTotal) {
        let novasCartelas = [];
        for (let i = 0; i < quantidade; i++) {
            let nums = [];
            while (nums.length < 15) {
                let n = Math.floor(Math.random() * 50) + 1;
                if (!nums.includes(n)) nums.push(n);
            }
            nums.sort((a, b) => a - b); // Correção: ordena a cartela individual
            novasCartelas.push(nums);
        }

        await User.findByIdAndUpdate(usuarioId, {
            $inc: { saldo: -precoTotal },
            $push: { cartelas: { $each: novasCartelas } }
        });

        jogo.premioAcumulado += (precoTotal * 0.7);
        res.json({ success: true });
    } else {
        res.status(400).json({ message: "Saldo insuficiente" });
    }
});

// --- ADMIN E AUTH ---
app.post('/admin/add-saldo', async (req, res) => {
    const { userId, valor } = req.body;
    await User.findByIdAndUpdate(userId, { $inc: { saldo: valor } });
    res.json({ success: true });
});

app.post('/admin/reset', async (req, res) => {
    jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300 };
    await User.updateMany({}, { cartelas: [] });
    res.json({ success: true });
});

app.post('/register', async (req, res) => {
    try { const u = new User(req.body); await u.save(); res.status(201).json(u); }
    catch (e) { res.status(400).json({message: "Erro"}); }
});

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json(u); else res.status(401).json({message: "Erro"});
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Bingo rodando na porta " + PORT));
