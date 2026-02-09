const restify = require('restify');
const Redis = require('ioredis');
const {v4: uuidv4} = require('uuid');

const redis = new Redis(process.env.REDIS_URL || {     
  host: 'localhost',
  port: 6379,
});

const server = restify.createServer({ name: 'ejemplo-api'});
server.use(restify.plugins.bodyParser());

//Handle OPTIONS REQUEST FOR CORS
server.opts('/*', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.send(200);
    return next();
});

// CORS headers para todas las respuestas
server.pre((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return next();
});

// POST /data - guarda un valor en Redis
server.post('/data', async (req, res) => {
    try {
        const payload = req.body || {}
        const key = 'datos'
        const item = payload.hasOwnProperty('value') ? payload.value : payload;

        const raw = await redis.get(key);
        let arr = [];
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    arr = parsed;
                }
                else
                    arr = [parsed];
            } catch (e) {
                arr = [raw];
            }
        }

        arr.push(item);
        await redis.set(key, JSON.stringify(arr));

        res.send(201, {key, length: arr.length});
    } catch (err) {
        res.send(500, {error: err.message});
    }
});

// GET /data/:key - obtiene el valor guardado
server.get('/data/:key', async (req, res) => {
    try {
        const key = req.params.key;
        const raw = await redis.get(key);
        if (!raw) {
            res.send(404, {error: 'Key not found'});
            return;
        }

        const parsed = JSON.parse(raw);
        res.send(200, {key, value: parsed});
    } catch (err) {
        res.send(500, {error: err.message});
    }
});

// DELETE /data/:key - elimina la clave
server.del('/data/:key', async (req, res) => {
    try {
        const key = req.params.key;
        const removed = await redis.del(key);
        res.send(200, {key, removed: removed === 1});
    } catch (err) {
        res.send(500, {error: err.message});
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`${server.name} escuchando en el puerto ${PORT}`);
});

// handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Cerrando servidor...');
    try {
        await redis.quit();
        process.exit(0);
    } catch (err) {
        console.error('Error al cerrar Redis:', err);
        process.exit(1);
    }
});