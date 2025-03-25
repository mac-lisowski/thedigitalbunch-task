declare module 'stream-chain' {
    import { Transform } from 'stream';

    export function chain(transformers: any[]): Transform;

    const streamChain: {
        chain: (transformers: any[]) => Transform;
    };

    export default streamChain;
} 