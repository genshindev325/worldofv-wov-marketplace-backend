import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import { AssetSize } from '@generated/ts-proto/types/asset';
import { Injectable } from '@nestjs/common';
import { picasso } from '@vechain/picasso';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import getImageSize from 'image-size';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { Readable } from 'stream';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdtemp = promisify(fs.mkdtemp);
const rm = promisify(fs.rm);

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

interface ConvertMediaOptions {
  size: number;
  fit: 'cover' | 'inside';
  animated: boolean;
}

@Injectable()
export class ImageThumbnailGenerationService {
  private static getConvertMediaOptionsFromSize(inputSize: AssetSize) {
    let size: ConvertMediaOptions['size'];
    let fit: ConvertMediaOptions['fit'];
    let animated: ConvertMediaOptions['animated'];

    switch (inputSize) {
      case AssetSize.STATIC_COVER_128:
        size = 128;
        fit = 'cover';
        animated = false;
        break;

      case AssetSize.STATIC_COVER_256:
        size = 256;
        fit = 'cover';
        animated = false;
        break;

      case AssetSize.STATIC_COVER_512:
        size = 512;
        fit = 'cover';
        animated = false;
        break;

      case AssetSize.ANIMATED_INSIDE_512:
        size = 512;
        fit = 'inside';
        animated = true;
        break;

      case AssetSize.ANIMATED_INSIDE_1024:
        size = 1024;
        fit = 'inside';
        animated = true;
        break;

      default:
        throw new Error(`Usupported asset size: ${inputSize}`);
    }

    return { size, fit, animated };
  }

  private async getVideoSize(
    source: string | Readable,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      return ffmpeg(source)
        .outputOption('-show_entries stream=width,height')
        .ffprobe((error, data) => {
          if (error) return reject(error);

          const stream = data.streams.find((s) => s.codec_type === 'video')!;

          if (stream?.width && stream?.height) {
            resolve({ width: stream.width, height: stream.height });
          } else {
            reject(new Error(`[${this.getVideoSize.name}] Invalid source.`));
          }
        });
    });
  }

  async convertVideo(data: Buffer, extension: string, assetSize: AssetSize) {
    const { animated, fit, size } =
      ImageThumbnailGenerationService.getConvertMediaOptionsFromSize(assetSize);

    let outputFormat: string;
    const outputOptions: string[] = [];
    const videoFilters: string[] = [];

    if (animated) {
      outputFormat = 'mp4';

      // Enable row based multithreading.
      outputOptions.push('-row-mt 1');

      // Allow the video to begin playing before it is completely downloaded.
      outputOptions.push('-movflags +faststart');

      // 'film'         –> Use for high quality movie content; lowers deblocking.
      // 'animation'    –> Good for cartoons; uses higher deblocking and more reference frames.
      // 'grain'        –> Preserves the grain structure in old, grainy film material.
      // 'stillimage'   –> Good for slideshow-like content.
      // 'fastdecode'   –> Allows faster decoding by disabling certain filters.
      // 'zerolatency'  –> Good for fast encoding and low-latency streaming.
      // 'psnr'         –> Ignore this as it is only used for codec development.
      // 'ssim'         –> Ignore this as it is only used for codec development.
      outputOptions.push('-tune animation');
    } else {
      outputFormat = 'webp';

      // Try to find the most representative frames in the video within the
      // first 120 frames.
      videoFilters.push('thumbnail=120');

      // Select only the first thumbnail.
      outputOptions.push('-frames:v 1');

      // 'none'     -> Do not use a preset.
      // 'default'  -> Use the encoder default.
      // 'picture'  -> Digital picture, like portrait, inner shot.
      // 'photo'    -> Outdoor photograph, with natural lighting.
      // 'drawing'  -> Hand or line drawing, with high-contrast details.
      // 'icon'     -> Small-sized colorful images.
      // 'text'     -> Text-like.
      outputOptions.push('-preset icon');
    }

    let tmpPath: string;

    try {
      // Input and output buffers are temporarily saved to the file system for
      // processing. I believe we could also pipe the buffers directly to the
      // process but this is fast and easy.

      tmpPath = await mkdtemp(path.join(os.tmpdir(), 'raw-'));

      const inputFile = path.format({
        dir: tmpPath,
        name: 'in',
        ext: '.' + extension,
      });

      const outputFile = path.format({
        dir: tmpPath,
        name: 'out',
        ext: '.' + outputFormat,
      });

      await writeFile(inputFile, data);

      const { width: srcWidth, height: srcHeight } = await this.getVideoSize(
        inputFile,
      );

      // We don't want to create thumbnails if the media is already smaller than
      // the desired size.
      if (srcWidth < size && srcHeight < size) {
        return null;
      }

      // The original image is resized so that it will never be larger than the
      // original size.
      const wantedWidth = Math.min(srcWidth, size);
      const wantedHeight = Math.min(srcHeight, size);

      let ratio: number;

      // Mantain the original image aspect ratio.
      // Adapted from https://stackoverflow.com/a/14731922
      switch (fit) {
        case 'cover':
          // Fill all the available space so the image can be successively cropped
          // to size.
          ratio = Math.max(wantedWidth / srcWidth, wantedHeight / srcHeight);
          break;

        case 'inside':
          // Resize the image to fit within the allotted dimensions.
          ratio = Math.min(wantedWidth / srcWidth, wantedHeight / srcHeight);
          break;
      }

      let width = srcWidth * ratio;
      let height = srcHeight * ratio;

      // Width and height must be rounded to the nearest multiple of 2 otherwise
      // the conversion will fail.
      width = Math.round(width / 2) * 2;
      height = Math.round(height / 2) * 2;

      // Scale the image to the desired size.
      videoFilters.push(`scale=${width}:${height}`);

      if (fit === 'cover') {
        // Crop the image to fit within the given constraints.
        videoFilters.push(`crop='min(in_w,${size})':'min(in_h,${size})`);
      }

      await new Promise((resolve, reject) => {
        ffmpeg(inputFile)
          .videoFilters(videoFilters)
          .outputOptions(outputOptions)
          .on('end', (d) => resolve(d))
          .on('error', (e) => reject(e))
          .save(outputFile);
      });

      return readFile(outputFile);
    } finally {
      await rm(tmpPath, { recursive: true, force: true });
    }
  }

  async convertImage(data: Buffer, assetSize: AssetSize) {
    const { animated, fit, size } =
      ImageThumbnailGenerationService.getConvertMediaOptionsFromSize(assetSize);

    const { width: srcWidth, height: srcHeight } = await getImageSize(data);

    if (srcWidth < size && srcHeight < size) {
      return null;
    }

    return sharp(data, {
      animated,
      limitInputPixels: false,
      unlimited: true,
    })
      .rotate() // Automatically orient the image based on EXIF orientation.
      .resize({
        height: size,
        width: size,
        fit,
        withoutEnlargement: true,
      })
      .webp({
        quality: 80,
      })
      .toBuffer();
  }

  async generateProfileImage(userAddress: string) {
    const svg = picasso(userAddress);

    const buffer = await sharp(Buffer.from(svg))
      .resize({ height: 2048, width: 2048 })
      .webp({ quality: 80 })
      .toBuffer();

    return this.convertImage(buffer, AssetSize.ANIMATED_INSIDE_1024);
  }
}
