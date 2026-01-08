const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// Conecta ao Mercado Pago com o seu Token do Render
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);

// Conecta ao MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Bingo Conectado!"))
  .catch(err => console.error("Erro Banco:", err));

// Modelo do Jogador
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    saldo: { type: Number, default: 0 }
}));

// ROTA: Cria o usuário se não existir (Resolve o banco vazio)
app.post('/criar-usuario', async (req, res) => {
    try {
        let user = await User.findOne({ email: req.body.email });
        if (!user) user = await User.create(req.body);
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ROTA: Busca dados do usuário
app.get('/user-data/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user || {});
    } catch (e) { res.status(404).json({ error: "Não encontrado" }); }
});

// ROTA: GERAR PIX (CORRIGIDA)
app.post('/gerar-pix', async (req, res) => {
    const { valor, userId } = req.body;
    try {
        const response = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: 'Deposito Bingo Real',
                payment_method_id: 'pix',
                payer: { 
                    email: "comprador_aleatorio@gmail.com" // Email fake para não bloquear você
                },
                metadata: { user_id: userId }
            }
        });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) {
        console.error("Erro MP:", e);
        res.status(500).json({ error: "Falha ao gerar PIX" });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor Online"));
