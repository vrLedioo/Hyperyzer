import { Config } from "@remotion/cli/config";

// H.264 MP4 is the default codec; set explicitly for clarity. JPEG frames keep
// rendering fast and small (no transparency needed for this ad).
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setOverwriteOutput(true);
