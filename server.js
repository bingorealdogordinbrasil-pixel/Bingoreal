const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Rota inicial para testar se o servidor está vivo e evitar o erro "Cannot GET /"
app.get('/', (req, res) => {
    res.send("Servidor do Bingo Real está Online e Funcional!");
});

// URL DO MONGODB COM A SENHA QUE VOCÊ DEFINIU
const mongoURI = "mongodb+srv://admin:bingoreal123@cluster0.ap7q4ev.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("Bingo Real: Conectado ao MongoDB com sucesso!"))
    .catch(err => {
        console.log("Erro de conexão no MongoDB:", err.message);
    });

// MODELO DE USUÁRIO
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    senha: String,
    saldo: { type: Number, default: 0 },
    cartelas: { type: Array, default: [] }
}));

// ESTADO DO JOGO
let jogo = {
    bolas: [],
    fase: "acumulando", 
    premioAcumulado: 0,
    tempoSegundos: 300 
};

// MOTOR DO BINGO (Sorteio Automático)
setInterval(() => {
    if (jogo.tempoSegundos > 0) {
        jogo.tempoSegundos--;
        jogo.fase = "acumulando";
    } else {
        jogo.fase = "sorteio";
        if (jogo.bolas.length < 50 && (Math.abs(jogo.tempoSegundos) % 10 === 0)) {
            sortearBola();
        }
        jogo.tempoSegundos--; 
    }
}, 1000);

function sortearBola() {
    if (jogo.bolas.length >= 50) return;
    let bola;
    do {
        bola = Math.floor(Math.random() * 50) + 1;
    } while (jogo.bolas.includes(bola));
    jogo.bolas.push(bola);
    console.log(`Bola Sorteada: ${bola}`);
}

// ROTAS DE API
app.get('/game-status', (req, res) => res.json(jogo));

app.post('/register', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).json(user);
    } catch (e) { res.status(400).json({ error: "Erro ao registrar" }); }
});

app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if (user) res.json(user); 
    else res.status(401).json({ error: "Login inválido" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
