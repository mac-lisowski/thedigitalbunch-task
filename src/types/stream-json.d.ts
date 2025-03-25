declare module 'stream-json' {
    import { Transform } from 'stream';

    export function parser(): Transform;

    const streamJson: {
        parser: () => Transform;
    };

    export default streamJson;
}

declare module 'stream-json/streamers/StreamArray.js' {
    import { Transform } from 'stream';

    export function streamArray(): Transform;

    const streamArrayModule: {
        streamArray: () => Transform;
    };

    export default streamArrayModule;
} 