const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// URL DO MONGODB COM A SUA SENHA CONFIGURADA
const mongoURI = "mongodb+srv://admin:db_bingo123@cluster0.ap7q4ev.mongodb.net/?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("Bingo Real: Conectado ao Banco de Dados!"))
    .catch(err => console.log("Erro ao conectar no MongoDB:", err));

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

// MOTOR AUTOMÁTICO DO BINGO
setInterval(() => {
    if (jogo.tempoSegundos > 0) {
        jogo.tempoSegundos--;
        jogo.fase = "acumulando";
    } else {
        jogo.fase = "sorteio";
        // Sorteia uma bola a cada 10 segundos quando o tempo acaba
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

// ROTAS DO JOGO
app.get('/game-status', (req, res) => res.json(jogo));

app.get('/user-data/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (e) { res.status(404).json({ error: "Usuário não encontrado" }); }
});

app.post('/register', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).json(user);
    } catch (e) { res.status(400).json({ error: "Erro ao criar conta" }); }
});

app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, senha: req.body.senha });
    if (user) res.json(user); 
    else res.status(401).json({ error: "E-mail ou senha incorretos" });
});

app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    if (jogo.fase !== "acumulando") return res.status(400).json({ error: "Sorteio em andamento" });

    const precoTotal = quantidade * 2;
    const user = await User.findById(usuarioId);

    if (user && user.saldo >= precoTotal) {
        let novasCartelas = [];
        for (let i = 0; i < quantidade; i++) {
            let nums = [];
            while (nums.length < 15) {
                let n = Math.floor(Math.random() * 50) + 1;
                if (!nums.includes(n)) nums.push(n);
            }
            novasCartelas.push(nums.sort((a, b) => a - b));
        }

        await User.findByIdAndUpdate(usuarioId, {
            $inc: { saldo: -precoTotal },
            $push: { cartelas: { $each: novasCartelas } }
        });

        jogo.premioAcumulado += (precoTotal * 0.7);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: "Saldo insuficiente" });
    }
});

// ROTA ADMIN PARA REINICIAR O JOGO
app.post('/admin/reset', async (req, res) => {
    jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300 };
    await User.updateMany({}, { cartelas: [] });
    res.json({ success: true, message: "Jogo reiniciado" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor Bingo Real rodando na porta ${PORT}`));
