## 1. Example JS

    const commandArguments = [
      "-hide_banner",
      "-loglevel","panic",
      "-y",
      "-framerate", "0.2",
      "-loop","1",
      "-i", image,
      "-i", audio,
      "-c:v","h264",
      "-tune", "stillimage",
      "-shortest",
      dest,
    ];

    console.log(command, commandArguments.join(" "));
    const { stdout } = await execFile(command, commandArguments);
    if (stdout) console.log(stdout);


## 2. COMPRESS STILL image AS a 1024x1024 AVIF (~50kb)
ffmpeg ... -f avif cover.avif

## 3. SAVE TEXT KEY to text.md

## 4. PLACE files IN A DIRECTORY where completed tasks tranditionally go to
