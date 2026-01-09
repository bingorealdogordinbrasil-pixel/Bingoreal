const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send("Servidor Bingo Real Online!"));

const mongoURI = "mongodb+srv://admin:bingoreal123@cluster0.ap7q4ev.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(mongoURI).then(() => console.log("Conectado ao MongoDB!"));

const User = mongoose.model('User', new mongoose.Schema({
    name: String, email: { type: String, unique: true },
    senha: String, saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

let jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300 };

// ROTA PARA SIMULAR GERAÇÃO DE PIX
app.post('/gerar-pix', (req, res) => {
    const { valor } = req.body;
    if (valor < 1) return res.status(400).json({ error: "Valor inválido" });
    // Aqui você coloca sua chave Pix Real ou link de pagamento
    res.json({ copiaECola: "SUA_CHAVE_PIX_AQUI_OU_LINK_PAGAMENTO" });
});

// Outras rotas (Login, Register, Comprar) seguem a mesma lógica anterior...
app.post('/register', async (req, res) => {
    try { const u = new User(req.body); await u.save(); res.status(201).json(u); }
    catch (e) { res.status(400).json({error: "Erro"}); }
});

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if(u) res.json(u); else res.status(401).json({error: "Erro"});
});

app.get('/game-status', (req, res) => res.json(jogo));
app.get('/user-data/:id', async (req, res) => res.json(await User.findById(req.params.id)));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Rodando na porta " + PORT));
