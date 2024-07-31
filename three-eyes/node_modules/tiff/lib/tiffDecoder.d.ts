import { IOBuffer } from 'iobuffer';
import TiffIfd from './tiffIfd';
import { BufferType, DecodeOptions } from './types';
export default class TIFFDecoder extends IOBuffer {
    private _nextIFD;
    constructor(data: BufferType);
    get isMultiPage(): boolean;
    get pageCount(): number;
    decode(options?: DecodeOptions): TiffIfd[];
    private decodeHeader;
    private decodeIFD;
    private decodeIFDEntry;
    private decodeImageData;
    private readStripData;
    private fillUncompressed;
    private applyPredictor;
    private convertAlpha;
}
