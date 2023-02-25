import Password from "./Password.mjs"

import base16 from "./Util/base16.mjs"

export default class Cipher {
    /**
     * @param {{ salt: ArrayBufferLike, privateKey: CryptoKey, publicKey: CryptoKey }}
     */
    constructor({ privateKey, publicKey, salt }) {
        this.privateKey = privateKey

        this.publicKey = publicKey

        this.salt = salt
    }

    /**
     * Encrypt sensitive data using the given password and export the cipher.
     * 
     * @param {Password} [password]
     * @returns {Promise<{ k: string, p: string, s: string }>}
     */
    async export(password = null) {
        password ??= await Password.recall()

        const
            wrappedPrivateKey = password.wrap(this.privateKey, this.salt),
            exportedPublicKey = crypto.subtle.exportKey(
                'spki',
                this.publicKey
            )

        return {
            k: base16.encode(await wrappedPrivateKey),
            p: base16.encode(await exportedPublicKey),
            s: base16.encode(this.salt)
        }
    }

    /**
     * Generate a new cipher.
     * 
     * @returns {Promise<Cipher>}
     */
    static async generate() {
        const
            [salt, keyPair] = await Promise.all([
                crypto.getRandomValues(new Uint8Array(16)),
                crypto.subtle.generateKey(
                    {
                        name: 'RSA-OAEP',
                        modulusLength: 4096,
                        publicExponent: new Uint8Array([1, 0, 1]),
                        hash: 'SHA-256'
                    },
                    true,
                    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
                )
            ]),
            privateKey = keyPair.privateKey,
            publicKey = keyPair.publicKey

        return new this({ salt, privateKey, publicKey })
    }

    /**
     * Parse and decrypt a previously exported cipher using the given password.
     * 
     * @param {{ k: string, p: string, s: string }}
     * @param {Password} [password]
     * @returns {Promise<Cipher>}
     */
    static async import({ k, p, s }, password = null) {
        password ??= await Password.recall()

        const
            salt = base16.decode(s),
            exportedPublicKey = base16.decode(p),
            wrappedPrivateKey = base16.decode(k)

        const [privateKey, publicKey] = await Promise.all([
            password.unwrap(wrappedPrivateKey, salt),
            crypto.subtle.importKey(
                'spki',
                exportedPublicKey,
                {
                    name: 'RSA-OAEP',
                    hash: 'SHA-256'
                },
                true,
                ['encrypt', 'wrapKey']
            )
        ])

        return new this({
            privateKey,
            publicKey,
            salt,
        })
    }
}