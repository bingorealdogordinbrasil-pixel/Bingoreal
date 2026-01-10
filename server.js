const express = require('express'); 
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '/')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const SENHA_ADMIN = "bingo2026"; 

const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-2683158167668377-123121-4666c74759e0eac123b8c4c23bf7c1f1-485513741' 
});
const payment = new Payment(client);

const mongoURI = "mongodb+srv://admin:bingoreal123@cluster0.ap7q4ev.mongodb.net/?retryWrites=true&w=majority";
mongoose.connect(mongoURI);

const User = mongoose.model('User', new mongoose.Schema({
    name: { type: String, required: true }, 
    email: { type: String, unique: true, required: true }, 
    senha: { type: String, required: true },
    saldo: { type: Number, default: 0 }, 
    cartelas: { type: Array, default: [] },
    cartelasProximaRodada: { type: Array, default: [] }, // ADICIONADO SEM MEXER NO RESTO
    valorLiberadoSaque: { type: Number, default: 0 } 
}));

const Withdrawal = mongoose.model('Withdrawal', new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    userName: String,
    valor: Number,
    chavePix: String,
    status: { type: String, default: 'pendente' },
    data: { type: Date, default: Date.now }
}));

let lucroGeralAcumulado = 0; 
let jogo = { 
    bolas: [], 
    fase: "acumulando", 
    premioAcumulado: 0, 
    tempoSegundos: 300, 
    ganhador: null, 
    valorGanho: 0,
    totalVendasRodada: 0 
};

// LOOP PRINCIPAL (MANTIDO EXATAMENTE COMO O SEU)
setInterval(async () => {
    if (jogo.fase === "acumulando") {
        if (jogo.tempoSegundos > 0) jogo.tempoSegundos--;
        else jogo.fase = "sorteio";
    } else if (jogo.fase === "sorteio") {
        if (Math.abs(jogo.tempoSegundos) % 3 === 0) await realizarSorteio();
        jogo.tempoSegundos--;
    } else if (jogo.fase === "finalizado") {
        if (Math.abs(jogo.tempoSegundos) >= 15) await reiniciarGlobal(); // Agora chama async
        jogo.tempoSegundos++;
    }
}, 1000);

async function realizarSorteio() {
    if (jogo.bolas.length >= 50 || jogo.fase !== "sorteio") return;
    let bola;
    do { bola = Math.floor(Math.random() * 50) + 1; } while (jogo.bolas.includes(bola));
    jogo.bolas.push(bola);

    const todosUsuarios = await User.find({ "cartelas.0": { $exists: true } });
    let ganhadoresNestaRodada = [];

    for (let u of todosUsuarios) {
        for (let c of u.cartelas) {
            if (c.every(num => jogo.bolas.includes(num))) {
                ganhadoresNestaRodada.push(u);
                break; 
            }
        }
    }

    if (ganhadoresNestaRodada.length > 0) {
        const valorPorGanhador = jogo.premioAcumulado / ganhadoresNestaRodada.length;
        for (let g of ganhadoresNestaRodada) {
            await User.findByIdAndUpdate(g._id, { 
                $inc: { saldo: valorPorGanhador, valorLiberadoSaque: valorPorGanhador } 
            });
        }
        lucroGeralAcumulado += (jogo.totalVendasRodada - jogo.premioAcumulado);
        jogo.ganhador = ganhadoresNestaRodada.length > 1 ? `${ganhadoresNestaRodada.length} Ganhadores` : ganhadoresNestaRodada[0].name;
        jogo.valorGanho = valorPorGanhador;
        jogo.fase = "finalizado";
        jogo.tempoSegundos = 0;
        await User.updateMany({}, { $set: { cartelas: [] } });
    }
}

// REINICIAR GLOBAL CORRIGIDO - MOVE AS CARTELAS DA ESPERA PARA O JOGO
async function reiniciarGlobal() {
    try {
        const usersComEspera = await User.find({ "cartelasProximaRodada.0": { $exists: true } });
        let vendasIniciais = 0;

        for (let u of usersComEspera) {
            vendasIniciais += (u.cartelasProximaRodada.length * 2);
            await User.findByIdAndUpdate(u._id, {
                $set: { cartelas: u.cartelasProximaRodada, cartelasProximaRodada: [] }
            });
        }

        jogo = { 
            bolas: [], 
            fase: "acumulando", 
            premioAcumulado: (vendasIniciais * 0.25), 
            tempoSegundos: 300, 
            ganhador: null, 
            valorGanho: 0, 
            totalVendasRodada: vendasIniciais 
        };
    } catch (e) {
        // Se der erro, reinicia o jogo zerado para não travar o loop
        jogo = { bolas: [], fase: "acumulando", premioAcumulado: 0, tempoSegundos: 300, ganhador: null, valorGanho: 0, totalVendasRodada: 0 };
    }
}

// COMPRA DE CARTELA COM LOGICA DE ESPERA
app.post('/comprar-com-saldo', async (req, res) => {
    const { usuarioId, quantidade } = req.body;
    const custo = parseInt(quantidade) * 2;
    const user = await User.findById(usuarioId);
    
    if (user && user.saldo >= custo) {
        let novas = [];
        for (let i = 0; i < quantidade; i++) {
            let n = [];
            while(n.length < 8) {
                let num = Math.floor(Math.random()*50)+1;
                if(!n.includes(num)) n.push(num);
            }
            novas.push(n.sort((a,b)=>a-b));
        }

        const campoAlvo = (jogo.fase === "acumulando") ? "cartelas" : "cartelasProximaRodada";

        await User.findByIdAndUpdate(usuarioId, { 
            $inc: { saldo: -custo },
            $push: { [campoAlvo]: { $each: novas } } 
        });

        if (jogo.fase === "acumulando") {
            jogo.premioAcumulado += (custo * 0.25);
            jogo.totalVendasRodada += custo; 
        }

        res.json({ success: true });
    } else res.status(400).send();
});

// --- RESTO DAS ROTAS MANTIDAS INTEGRALMENTE ---
app.get('/top-ganhadores', async (req, res) => {
    try {
        const tops = await User.find({ valorLiberadoSaque: { $gt: 0 } }).sort({ valorLiberadoSaque: -1 }).limit(10).select('name valorLiberadoSaque');
        res.json(tops);
    } catch (e) { res.status(500).send(); }
});

app.post('/admin/dashboard', async (req, res) => {
    if (req.body.senha !== SENHA_ADMIN) return res.status(401).send();
    const jogadores = await User.find({}, 'name email saldo valorLiberadoSaque _id');
    const saques = await Withdrawal.find().sort({ data: -1 });
    const lucroDestaRodada = jogo.totalVendasRodada - jogo.premioAcumulado;
    res.json({ jogadores, saques, lucroRodada: lucroDestaRodada, lucroTotalHistorico: lucroGeralAcumulado + lucroDestaRodada, vendasRodada: jogo.totalVendasRodada });
});

app.post('/solicitar-saque', async (req, res) => {
    const { userId, valor, chavePix } = req.body;
    const v = parseFloat(valor);
    try {
        const user = await User.findById(userId);
        if (!user || v > user.valorLiberadoSaque || user.saldo < v || v < 20) return res.status(400).json({ error: "Erro no saque ou valor não liberado." });
        await User.findByIdAndUpdate(userId, { $inc: { saldo: -v, valorLiberadoSaque: -v } });
        const pedido = new Withdrawal({ userId: user._id, userName: user.name, valor: v, chavePix: chavePix });
        await pedido.save();
        res.json({ success: true });
    } catch (e) { res.status(500).send(); }
});

app.post('/gerar-pix', async (req, res) => {
    const { userId, valor } = req.body;
    try {
        const response = await payment.create({ body: { transaction_amount: parseFloat(valor), description: "Bingo Real", payment_method_id: "pix", payer: { email: "cliente@bingoreal.com" }, external_reference: userId.toString() } });
        res.json({ qr_code: response.point_of_interaction.transaction_data.qr_code, qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64 });
    } catch (e) { res.status(500).json(e); }
});

app.post('/admin/dar-bonus', async (req, res) => {
    const { senha, userId, valor } = req.body;
    if (senha !== SENHA_ADMIN) return res.status(401).send();
    await User.findByIdAndUpdate(userId, { $inc: { saldo: parseFloat(valor) } });
    res.json({ success: true });
});

app.post('/webhook', async (req, res) => {
    const { action, data } = req.body;
    if (action === "payment.updated") {
        try {
            const p = await payment.get({ id: data.id });
            if (p.status === "approved") await User.findByIdAndUpdate(p.external_reference, { $inc: { saldo: p.transaction_amount } });
        } catch (e) {}
    }
    res.sendStatus(200);
});

app.post('/login', async (req, res) => {
    const u = await User.findOne({ email: req.body.email, senha: req.body.senha });
    u ? res.json(u) : res.status(401).send();
});

app.post('/register', async (req, res) => {
    try { const u = new User(req.body); await u.save(); res.json(u); } catch(e) { res.status(400).send(); }
});

app.get('/game-status', (req, res) => res.json(jogo));
app.get('/user-data/:id', async (req, res) => {
    try { const u = await User.findById(req.params.id); res.json(u); } catch (e) { res.status(404).send(); }
});

app.listen(process.env.PORT || 10000);
