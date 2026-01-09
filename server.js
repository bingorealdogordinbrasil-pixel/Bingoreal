const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURAÇÃO MERCADO PAGO
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);

// CONEXÃO MONGODB
mongoose.connect(process.env.MONGO_URI);

// --- ESTA PARTE FAZ O JOGO APARECER NO LINK ---
app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ROTAS DO JOGO
app.post('/criar-usuario', async (req, res) => {
    try {
        let user = await User.findOne({ email: req.body.email });
        if (!user) user = await User.create(req.body);
        res.json(user);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const User = mongoose.model('User', new mongoose.Schema({
    name: String, email: { type: String, unique: true }, saldo: { type: Number, default: 0 }
}));

app.get('/user-data/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (e) { res.status(404).send("User not found"); }
});

app.post('/gerar-pix', async (req, res) => {
    const { valor, userId } = req.body;
    try {
        const response = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: 'Deposito Bingo Real',
                payment_method_id: 'pix',
                payer: { email: 'comprador@bingoreal.com' },
                metadata: { user_id: userId }
            }
        });
        res.json(response.point_of_interaction.transaction_data);
    } catch (e) { res.status(500).json(e); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Bingo Rodando!"));
