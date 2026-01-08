const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// 1. SERVIR O SITE (Resolve o erro Not Found e abre o HTML)
app.use(express.static(path.join(__dirname, '.')));

// 2. CONFIGURAÇÃO MERCADO PAGO
// O token APP_USR que você salvou no Render deve ser da conta emanntossilva@gmail.com
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});
const payment = new Payment(client);

// 3. CONEXÃO MONGODB
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI).then(() => console.log("Bingo Conectado ao Banco!"));

// MODELO DE USUÁRIO
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// ROTA PARA ABRIR O SITE
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 4. ROTA DE GERAR PIX (Corrigida para evitar erro de QR Code)
app.post('/gerar-pix', async (req, res) => {
    const { email, valor, userId } = req.body;
    try {
        const response = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: 'Creditos Bingo Real',
                payment_method_id: 'pix',
                payer: { 
                    // Se o comprador for o mesmo dono da conta (você testando), o MP bloqueia.
                    // Por isso usamos um email fixo de teste caso seja o seu.
                    email: email === "emanntossilva@gmail.com" ? "comprador_teste@gmail.com" : (email || "cliente@teste.com"),
                    first_name: "Jogador",
                    last_name: "Bingo"
                },
                metadata: { user_id: userId }
            }
        });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) {
        console.error("ERRO MP:", e);
        res.status(500).json({ error: "Erro no Mercado Pago" });
    }
});

// 5. ROTA DE STATUS DO JOGO
app.get('/game-status', (req, res) => {
    res.json({ 
        bolas: [5, 12, 44], // Exemplo de bolas
        fase: "sorteio", 
        premioAcumulado: 150.00, 
        tempoSegundos: 120 
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor Online!"));
