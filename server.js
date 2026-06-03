const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3399;

// Sunucu oluştur
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('404 - Dosya Bulunamadi: ' + filePath, 'utf-8');
            } else {
                res.writeHead(500);
                res.end('500 - Sunucu Hatasi: ' + error.code, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n=========================================');
    console.log('🚀 PROFF_3D Sunucusu Başarıyla Başlatıldı!');
    console.log('=========================================\n');
    
    console.log(`🏠 Kendi bilgisayarınızda açmak için:`);
    console.log(`   http://localhost:${PORT}\n`);

    console.log(`📱 Ağa bağlı diğer cihazlardan (telefon vb.) girmek için:`);
    
    // Ağ arayüzlerini tara ve IPv4 adreslerini bul
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Sadece IPv4 olanları ve iç network (localhost) olmayanları filtrele
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`   👉 http://${iface.address}:${PORT}  (${name})`);
            }
        }
    }
    console.log('\n(Sunucuyu kapatmak için CTRL+C yapabilirsiniz)\n');
});
