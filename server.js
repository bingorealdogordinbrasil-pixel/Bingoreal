const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// 1. CONFIGURAÇÃO MERCADO PAGO
// Lê o token que você salvou no Render (imagem 13)
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN 
});
const payment = new Payment(client);

// 2. SERVIR ARQUIVOS (Isso resolve o erro "Cannot GET /" da imagem 8)
app.use(express.static(__dirname));

// 3. CONEXÃO MONGODB
// Usa o link que você pegou na imagem 12
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => console.log("Bingo Online e Banco Conectado!"))
    .catch(err => console.error("Erro ao conectar no MongoDB:", err));

const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// 4. ROTA PRINCIPAL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 5. ROTA DE PAGAMENTO PIX
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
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Erro ao gerar PIX" }); 
    }
});

// ... (Mantenha aqui as suas rotas de sorteio e lógica do jogo) ...

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));
