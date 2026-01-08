const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// 1. CONFIGURAÇÃO MERCADO PAGO
// O código vai ler o token que você salvou no Render
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});
const payment = new Payment(client);

// 2. SERVIR ARQUIVOS (Resolve o erro "Cannot GET /")
app.use(express.static(__dirname));

// 3. CONEXÃO MONGODB
const mongoURI = "mongodb+srv://emanntossilva_db_user:jdTfhDfvYbeSHnQH@cluster0.mxdnuqr.mongodb.net/bingo_db?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(mongoURI).then(() => console.log("MongoDB Conectado!"));

const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// 4. MOTOR DO BINGO
let jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300 };

setInterval(() => {
    if (jogo.tempoSegundos > 0) {
        jogo.tempoSegundos--;
        jogo.fase = "acumulando";
    } else {
        jogo.fase = "sorteio";
        if (jogo.bolas.length < 50 && (Math.abs(jogo.tempoSegundos) % 10 === 0)) {
            let bola;
            do { bola = Math.floor(Math.random() * 50) + 1; } 
            while (jogo.bolas.includes(bola) && jogo.bolas.length < 50);
            if(bola) jogo.bolas.push(bola);
        }
        jogo.tempoSegundos--;
    }
}, 1000);

// 5. ROTAS
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/game-status', (req, res) => res.json(jogo));

app.post('/gerar-pix', async (req, res) => {
    const { email, valor, userId } = req.body;
    try {
        const response = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: 'Créditos Bingo Real',
                payment_method_id: 'pix',
                payer: { email },
                metadata: { user_id: userId }
            }
        });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) { res.status(500).json(e); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Bingo rodando na porta " + PORT));
