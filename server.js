const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);

mongoose.connect(process.env.MONGO_URI).then(() => console.log("Conectado ao MongoDB!"));

const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// ROTA DE CRIAÇÃO AUTOMÁTICA DE USUÁRIO
app.post('/criar-usuario', async (req, res) => {
    try {
        let user = await User.findOne({ email: req.body.email });
        if (!user) user = await User.create(req.body);
        res.json(user);
    } catch (e) { res.status(500).json(e); }
});

app.post('/gerar-pix', async (req, res) => {
    const { email, valor, userId } = req.body;
    try {
        const response = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: 'Bingo Real Deposito',
                payment_method_id: 'pix',
                payer: { email: email === "emanntossilva@gmail.com" ? "teste@teste.com" : email },
                metadata: { user_id: userId }
            }
        });
        res.json({
            qr_code: response.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (e) { res.status(500).json(e); }
});

app.get('/user-data/:id', async (req, res) => {
    const user = await User.findById(req.params.id);
    res.json(user);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Servidor Online"));
