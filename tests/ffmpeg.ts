import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import which from 'which';

const getExecutablePath = (envVar: string, executable: string, installer: { path: string }) => {
  if (process.env[envVar]) {
    return process.env[envVar];
  }

  try {
    return which.sync(executable);
  } catch (error) {
    return installer.path;
  }
};

const ffmpegPath = getExecutablePath('EB_FFMPEG_PATH', 'ffmpeg', ffmpegInstaller);
const ffprobePath = getExecutablePath('EB_FFPROBE_PATH', 'ffprobe', ffprobeInstaller);

console.log(`Using ffmpeg from path: ${ffmpegPath}`);
console.log(`Using ffprobe from path: ${ffprobePath}`);

ffmpeg.setFfmpegPath(ffmpegPath!);
ffmpeg.setFfprobePath(ffprobePath!);

export enum EncodingType {
  CPU = 'libx264',
  NVIDIA = 'h264_nvenc',
  AMD = 'h264_amf',
  INTEL = 'h264_qsv',
  APPLE = 'h264_videotoolbox',
}

export const generateTestVideo = async (encodingType: EncodingType): Promise<void> => {
  console.log(`Generating test video using ${encodingType}...`);

  const startTime = Date.now();

  const outputOptions = [
    '-vf', 'scale=-2:720',
    '-c:v', encodingType,
    '-c:a', 'copy',
  ];

  // Adjust output options based on encoder for maximum quality
  switch(encodingType) {
    case EncodingType.CPU:
      outputOptions.push('-crf', '0');
      break;
    case EncodingType.NVIDIA:
      outputOptions.push('-rc', 'cqp', '-qp', '0');
      break;
    case EncodingType.AMD:
      outputOptions.push('-qp_i', '0', '-qp_p', '0', '-qp_b', '0');
      break;
    case EncodingType.INTEL:
      outputOptions.push('-global_quality', '1'); // Intel QSV specific setting for high quality
      break;
    case EncodingType.APPLE:
      outputOptions.push('-global_quality', '1');
      break;
  }

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input('test.mp4')
      .inputFormat('mp4')
      .outputOptions(outputOptions)
      .output(`720p-test-${encodingType}.mp4`)
      .on('end', () => {
        console.log(`720p copy complete using ${encodingType}, took ${Date.now() - startTime}ms to complete`);
        resolve();
      })
      .on('error', (e) => reject(new Error(e)))
      .run();
  });
};

// Test commands (uncomment to use)
// generateTestVideo(EncodingType.CPU).catch(console.error);
// generateTestVideo(EncodingType.AMD).catch(console.error);
// generateTestVideo(EncodingType.INTEL).catch(console.error);
// generateTestVideo(EncodingType.NVIDIA).catch(console.error);
// generateTestVideo(EncodingType.APPLE).catch(console.error);
