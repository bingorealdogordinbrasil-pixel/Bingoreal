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
    cartelasProximaRodada: { type: Array, default: [] }, // NOVO: Armazena compras feitas durante o sorteio
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

setInterval(async () => {
    if (jogo.fase === "acumulando") {
        if (jogo.tempoSegundos > 0) jogo.tempoSegundos--;
        else jogo.fase = "sorteio";
    } else if (jogo.fase === "sorteio") {
        if (Math.abs(jogo.tempoSegundos) % 3 === 0) await realizarSorteio();
        jogo.tempoSegundos--;
    } else if (jogo.fase === "finalizado") {
        if (Math.abs(jogo.tempoSegundos) >= 15) await reiniciarGlobal(); // Agora é async para carregar cartelas
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

// NOVO: Função reiniciarGlobal agora processa as cartelas em espera
async function reiniciarGlobal() {
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
}

// ROTA DE COMPRA ATUALIZADA
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

        // Se o jogo não estiver em fase de acumulação, salva para a próxima
        const destino = (jogo.fase === "acumulando") ? "cartelas" : "cartelasProximaRodada";

        await User.findByIdAndUpdate(usuarioId, { 
            $inc: { saldo: -custo },
            $push: { [destino]: { $each: novas } } 
        });

        if (jogo.fase === "acumulando") {
            jogo.premioAcumulado += (custo * 0.25);
            jogo.totalVendasRodada += custo; 
        }

        res.json({ success: true, agendado: (jogo.fase !== "acumulando") });
    } else res.status(400).send();
});

// ... (Resto das rotas: solicitar-saque, pix, login, etc, conforme enviado anteriormente)

app.listen(process.env.PORT || 10000);
