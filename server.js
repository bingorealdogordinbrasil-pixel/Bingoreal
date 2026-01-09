const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

// CONEXÃO COM SEU BANCO DE DADOS
const mongoURI = "mongodb+srv://bingorealdogordinbrasil_db_user:GQBlqipKL3a2Lpoa@cluster0.ap7q4ev.mongodb.net/bingo_pi?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("Conectado ao MongoDB: bingo_pi"));

// CONFIGURAÇÃO MERCADO PAGO (Ajuste o Token no painel do Render)
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TOKEN_TESTE' });
const payment = new Payment(client);

// MODELO DE USUÁRIO
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// ROTAS DE LOGIN E REGISTRO
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

// SERVIR O HTML
app.use(express.static(__dirname));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// PORTA PARA O RENDER
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em: http://0.0.0.0:${PORT}`);
});
