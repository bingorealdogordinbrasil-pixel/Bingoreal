const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// --- BANCO DE DADOS ---
const mongoURI = "mongodb+srv://admin:bingoreal123@cluster0.ap7q4ev.mongodb.net/?retryWrites=true&w=majority";
mongoose.connect(mongoURI).then(() => console.log("MongoDB Conectado")).catch(err => console.log(err));

// --- MODELO DE USUÁRIO ---
const User = mongoose.model('User', new mongoose.Schema({
    name: String, 
    email: { type: String, unique: true }, 
    senha: String,
    saldo: { type: Number, default: 0 },
    totalApostado: { type: Number, default: 0 },
    totalRecebido: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// --- CONFIGURAÇÃO ADMIN ---
const SENHA_ADMIN = "bingo2026";

// --- MOTOR DO JOGO ---
let jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300, totalVendasRodada: 0 };

// Rota de Registro com Criptografia
app.post('/register', async (req, res) => {
    try {
        const hash = await bcrypt.hash(req.body.senha, 10);
        const u = new User({ ...req.body, senha: hash });
        await u.save();
        res.json({ success: true });
    } catch(e) { res.status(400).send("Erro no registro"); }
});

// Rota de Login Segura
app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email });
    if (u && await bcrypt.compare(req.body.senha, u.senha)) {
        res.json(u);
    } else {
        res.status(401).send("Falha no login");
    }
});

// Outras rotas (Comprar, Status, Admin)
app.get('/game-status', (req, res) => res.json(jogo));
app.use(express.static(path.join(__dirname, '/')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(process.env.PORT || 10000, () => console.log("Servidor Online"));
