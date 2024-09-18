//Author: MaddiekC
const webpush = require('web-push');
const express = require('express')
const https = require('https');
const { HubConnectionBuilder } = require('@microsoft/signalr');
const app = express();


// Configurar la conexión a SignalR
const connection = new HubConnectionBuilder()

    .withUrl('https://localhost:7182/alertHub') // Cambia la URL según tu configuración
    .build();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Conectar a SignalR
connection.start()
    .then(() => console.log('Conectado a SignalR'))
    .catch(err => console.error('Error al conectar a SignalR:', err));

// Escuchar eventos de SignalR
connection.on('ReceiveImage', base64Image => {
    //console.log('Imagen recibida:', base64Image);
    triggerNotification(base64Image)
});

async function triggerNotification(ruta) {
    await getDataFromCSharpAPI('/api/Suscripcions')
    const Url_image = await getImage(ruta);
    console.log("AAAAAAAAA", Url_image)
    await enviarNotificacion(Url_image);
    //await uploadImageToCloudinary(filePath);

}

/////////
const vapidKeys = {
    "publicKey": "BHlTvNxZ8GH6GyNWxo_lOGGjwERRYgL1oyHzqSj9Ot7Aerxsl60wh_5MtdxKJeG8ld9vSd4LnLRJ1AglfqHBYtM",
    "privateKey": "-VuJTOAwC7HuVfV_ydXbwx4jlFy2LxXcSSunKDaFBzk"
}

webpush.setVapidDetails(
    'mailto:maddie@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

function getDataFromCSharpAPI(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 7182,
            path: endpoint,
            method: 'GET',
            rejectUnauthorized: false // Para permitir solicitudes a localhost sin SSL/TLS válido
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    tokens = parsedData;
                    resolve(parsedData);

                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}
let tokens = [];
// Ejemplo de uso en tu API de Node.js
app.get('/api/Suscripcions', async (req, res) => {
    try {
        const subscriptions = await getDataFromCSharpAPI('/api/Suscripcions');

        // Guardar suscripciones en la lista tokens
        tokens = subscriptions;
        res.json(tokens);

    } catch (error) {
        res.status(500).send('Error al obtener suscripciones', error);
        console.error("Error al obtener suscripciones", error)
    }
});

const cloudinary = require('cloudinary').v2;
// Configuración de Cloudinary con las credenciales
cloudinary.config({
    cloud_name: ' ',
    api_key: ' ',
    api_secret: ' '
});

function getImage(a) {
    return new Promise((resolve, reject) => {

        const options = {
            hostname: 'localhost',
            port: 7182,
            path: `/api/Alertas/GetImageByPath?rutaAlerta=${encodeURIComponent(a)}`,
            method: 'GET',
            rejectUnauthorized: false // Para permitir solicitudes a localhost sin SSL/TLS válido
        };
        // Función para eliminar la imagen anterior en Cloudinary
        const deletePreviousImage = async (publicId) => {
            try {
                await cloudinary.uploader.destroy(publicId);
                console.log(`Imagen con ID ${publicId} eliminada`);
            } catch (error) {
                console.error(`Error al eliminar la imagen anterior: ${error}`);
            }
        };
        const req = https.request(options, (res) => {
            let data = [];

            if (res.statusCode !== 200) {
                return reject(new Error(`Error al obtener la imagen. Código de estado: ${res.statusCode}`));
            }

            res.on('data', (chunk) => {
                data.push(chunk);
            });

            res.on('end', async () => {
                try {
                    filePath = Buffer.concat(data);
                    //resolve(filePath);
                    //console.log(filePath)
                    //console.log('Imagen obtenida y almacenada en variable');
                    // Elimina la imagen anterior con nombre "Luna" si existe
                    await deletePreviousImage('FM2K/Luna');

                    // Sube la imagen desde el Buffer a Cloudinary
                    const result = cloudinary.uploader.upload_stream(
                        { folder: 'FM2K', public_id: 'Luna', overwrite: true },
                        (error, result) => {
                            if (error) {
                                console.error('Error al subir imagen a Cloudinary:', error);
                                reject(error);
                            } else {
                                console.log('Resultado de la subida:', result);
                                resolve(result.secure_url); // Devolver la URL pública de la imagen
                            }
                        }
                    );

                    // Escribe el buffer a la subida del stream
                    result.end(filePath);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}


const enviarNotificacion = async (Url_image) => {
    try {
        //const base64Image = await getImage(); 

        // Convertir el buffer de imagen a base64 para usar en el payload
        //const base64Image = imageBuffer.toString('base64');
        tokens.forEach(token => {
            const pushSubcription = {
                endpoint: token.endpoint,
                keys: {
                    auth: token.keyAuth,
                    p256dh: token.keyP256dh
                }
            };
            const payload = {
                "notification": {
                    "title": "Notificacion",
                    "body": "Abre la notificación",
                    "vibrate": [100, 50, 100],
                    "image": Url_image,
                    "actions": [{
                        "action": "explore",
                        "title": "Ir al sitio",
                    }],
                    "data": {
                        "url": Url_image
                    }
                }
            };
            webpush.sendNotification(
                pushSubcription,
                JSON.stringify(payload)
            ).then(res => {
                console.log('Enviado', res);
            }).catch(err => {
                console.log('Error es', err);
            });
        });

        //res.send({ data: 'Se enviaron las notificaciones' });
    } catch (error) {
        //res.status(500).send('Error al enviar notificaciones');
        console.error('Error al enviar notificaciones', error);
    }
};

app.route('/api/imagen').post(getImage);

app.route('/api/enviar').post(enviarNotificacion);


app.route('/api/enviar2').post(async (req, res) => {
    try {
        const data = await getDataFromCSharpAPI('Suscripcions');
        res.json(data);
    } catch (error) {
        res.status(500).send('Error al obtener datos');
    }
});

const httpServer = app.listen(9000, () => {
    console.log("HTTP Server running at http:/localhost:" + httpServer.address().port);
})
//http://localhost:9000/api/enviar2        POST

//http://localhost:9000/api/Suscripcions  GET
//http://localhost:9000/api/enviar       POST

//http://localhost:9000/api/imagen       POST
//http://localhost:9000/api/base64       POST
