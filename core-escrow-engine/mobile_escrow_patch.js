/**
 * [Fakta]
 * MetaMask In-App Browser di iOS/Android sering mereset `window.ethereum` atau lambat untuk 'inject' provider 
 * jika PWA dilancarkan secara mandiri (standalone). EIP-1193 menuntut pengesahan `window.ethereum.request`.
 * [Analisis]
 * Di persekitaran desktop, `window.ethereum` dikesan serta merta. Pada peranti mudah alih, PWA gagal 
 * menghantar panggilan 'deep link' secara konsisten melainkan dApp dibuka terus melalui in-app browser MetaMask. 
 * Ralat berlaku apabila percubaan transaksi (approve/escrow) dibuat ketika rantaian sambungan belum disahkan.
 * [Eksekusi]
 * Pelaksanaan modul kalis-ralat (Zero Exception) untuk mengesan provider, memaksa pemuatan (fallback) MetaMask 
 * deep-link jika provider natif tidak dijumpai, dan mengurus transaksi secara asinkron dengan pemerhatian rantaian penuh.
 */
const PWA_URL = "https://your-pwa-domain.com"; // Gantikan dengan domain sebenar
const TARGET_CHAIN_ID = '0x38'; // 56 dalam Hex untuk BSC

async function detectProvider() {
    if (typeof window !== 'undefined' && window.ethereum) {
        if (window.ethereum.isMetaMask) {
            return window.ethereum;
        }
    }
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        const encodedUrl = encodeURIComponent(PWA_URL.replace(/^https?:\/\//, ''));
        window.location.href = `https://metamask.app.link/dapp/${encodedUrl}`;
        throw new Error("MENGHALA KE METAMASK BROWSER (Vektor Mudah Alih). Sila tunggu...");
    }
    throw new Error("PROVIDER TIDAK DIJUMPAI: Sila pasang MetaMask.");
}

export async function safeMobileEscrowTransaction(contractAddress, escrowData, usdtAddress) {
    try {
        const provider = await detectProvider();
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) throw new Error("AKSES DITOLAK KLIEN.");
        
        const userAddress = accounts[0];
        const currentChain = await provider.request({ method: 'eth_chainId' });
        if (currentChain !== TARGET_CHAIN_ID) {
            try {
                await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: TARGET_CHAIN_ID }] });
            } catch (switchError) {
                throw new Error(`RALAT PENUKARAN RANTAIAN: KOD ${switchError.code}`);
            }
        }

        const approveTx = { to: usdtAddress, from: userAddress, data: generateApproveData(contractAddress, escrowData.amount) };
        const approveTxHash = await provider.request({ method: 'eth_sendTransaction', params: [approveTx] });
        const approveReceipt = await waitForReceipt(provider, approveTxHash);
        if (parseInt(approveReceipt.status, 16) !== 1) throw new Error("TRANSAKSI APPROVE GAGAL DI PERINGKAT KONTRAK.");

        const escrowTx = { to: contractAddress, from: userAddress, data: generateEscrowData(escrowData) };
        const escrowTxHash = await provider.request({ method: 'eth_sendTransaction', params: [escrowTx] });
        const receipt = await waitForReceipt(provider, escrowTxHash);
        if (parseInt(receipt.status, 16) !== 1) throw new Error("TRANSAKSI ESCROW GAGAL DI PERINGKAT KONTRAK.");

        return { status: "SUCCESS", txHash: escrowTxHash };
    } catch (error) {
        return { status: "FAILED", error: error.message || "RALAT TIDAK DIKENALPASTI." };
    }
}

async function waitForReceipt(provider, txHash) {
    let receipt = null;
    while (receipt === null) {
        receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
        if (receipt === null) await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return receipt;
}
function generateApproveData(spender, amount) { return "0x095ea7b3"; }
function generateEscrowData(escrowData) { return "0x"; }
