const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// 1. CONFIGURAÇÃO MERCADO PAGO (Usando a Key que você salvou no Render)
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN || 'SUA_CHAVE_DE_TESTE_AQUI' 
});
const payment = new Payment(client);

// Servir arquivos estáticos (HTML, CSS, JS) - Resolve o "Cannot GET /"
app.use(express.static(__dirname));

// CONEXÃO COM O BANCO DE DADOS
const mongoURI = "mongodb+srv://emanntossilva_db_user:jdTfhDfvYbeSHnQH@cluster0.mxdnuqr.mongodb.net/bingo_db?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoURI).then(() => console.log("Banco de Dados Conectado!"));

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
}

// --- ROTA DE PAGAMENTO PIX (MERCADO PAGO) ---
app.post('/gerar-pix', async (req, res) => {
    const { email, valor, userId } = req.body;
    
    const body = {
        transaction_amount: Number(valor),
        description: 'Depósito Bingo Real',
        payment_method_id: 'pix',
        payer: { email },
        metadata: { user_id: userId } // Guarda o ID do usuário para dar o saldo depois
    };

    try {
        const result = await payment.create({ body });
        res.json({
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64,
            id_pagamento: result.id
        });
    } catch (error) {
        res.status(500).json(error);
    }
});

// --- DEMAIS ROTAS ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/game-status', (req, res) => {
    res.json(jogo);
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
            nums.sort((a, b) => a - b);
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

// AUTH
app.post('/register', async (req, res) => {
    try { const u = new User(req.body); await u.save(); res.status(201).json(u); }
    catch (e) { res.status(400).json({message: "Erro ao registrar"}); }
});

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json(u); else res.status(401).json({message: "Login inválido"});
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Bingo rodando na porta " + PORT));
