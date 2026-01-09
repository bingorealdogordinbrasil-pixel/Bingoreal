const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// 1. CONEXÃO COM O BANCO (USUÁRIO: admin | SENHA: bingo123)
const mongoURI = "mongodb+srv://admin:bingo123@cluster0.ap7q4ev.mongodb.net/bingo_pi?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ BANCO DE DADOS CONECTADO COM SUCESSO!"))
    .catch(err => console.error("❌ ERRO DE CONEXÃO NO MONGO:", err));

// 2. CONFIGURAÇÃO MERCADO PAGO
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-TOKEN' });
const payment = new Payment(client);

// 3. MODELO DE USUÁRIO
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// 4. ROTAS DE ACESSO
app.post('/register', async (req, res) => {
    try {
        const { name, email, senha } = req.body;
        const user = await User.create({ name, email, senha });
        res.status(201).json(user);
    } catch (e) { res.status(400).json({ message: "E-mail já cadastrado" }); }
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    const user = await User.findOne({ email, senha });
    if (user) res.json(user);
    else res.status(401).json({ message: "E-mail ou senha incorretos" });
});

app.get('/user-data/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (e) { res.status(404).send(); }
});

// 5. SERVIR O HTML (Ajuste para o Render)
app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 6. PORTA PARA O RENDER
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bingo Real online na porta ${PORT}`);
});
