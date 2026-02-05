/**
 * Script de Migracao: Adicionar campo isSuperAdmin ao admin principal
 *
 * Execucao: cd functions && node migrate-super-admin.js
 *
 * Este script busca o admin com email 3d3printers@gmail.com e adiciona
 * o campo isSuperAdmin: true ao documento.
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin (usa credenciais do ambiente local)
admin.initializeApp({
    projectId: 'imaginatech-servicos'
});

const db = admin.firestore();
const SUPER_ADMIN_EMAIL = '3d3printers@gmail.com';

async function migrateSuperAdmin() {
    console.log('Iniciando migracao de Super Admin...\n');

    try {
        // Buscar admin pelo email
        const snapshot = await db.collection('admins')
            .where('email', '==', SUPER_ADMIN_EMAIL)
            .get();

        if (snapshot.empty) {
            console.log(`AVISO: Nenhum admin encontrado com email ${SUPER_ADMIN_EMAIL}`);
            console.log('Criando documento de admin...\n');

            // Criar documento de admin
            const newAdminRef = await db.collection('admins').add({
                email: SUPER_ADMIN_EMAIL,
                name: 'Super Admin',
                active: true,
                isSuperAdmin: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Admin criado com ID: ${newAdminRef.id}`);
            console.log('Campo isSuperAdmin: true adicionado!');
        } else {
            // Atualizar documento existente
            const adminDoc = snapshot.docs[0];
            const adminData = adminDoc.data();

            console.log(`Admin encontrado: ${adminData.name || adminData.email}`);
            console.log(`ID do documento: ${adminDoc.id}`);
            console.log(`isSuperAdmin atual: ${adminData.isSuperAdmin || 'nao definido'}\n`);

            if (adminData.isSuperAdmin === true) {
                console.log('Admin ja possui isSuperAdmin: true. Nenhuma alteracao necessaria.');
            } else {
                await adminDoc.ref.update({
                    isSuperAdmin: true
                });
                console.log('Campo isSuperAdmin: true adicionado com sucesso!');
            }
        }

        // Listar todos os admins para verificacao
        console.log('\n--- Admins atuais ---');
        const allAdmins = await db.collection('admins').get();
        allAdmins.forEach(doc => {
            const data = doc.data();
            console.log(`- ${data.email} | active: ${data.active} | isSuperAdmin: ${data.isSuperAdmin || false}`);
        });

    } catch (error) {
        console.error('Erro durante migracao:', error);
        process.exit(1);
    }

    console.log('\nMigracao concluida!');
    process.exit(0);
}

migrateSuperAdmin();
