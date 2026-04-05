Use javascript

## 1. Loop $VIDEO_CLIP oer an over to cover the duration of mp3, it is important the full mp3 plays, the clip can repeat over and over
ffmpeg -stream_loop -1 -i $VIDEO_CLIP -i audio.mp3 -map 0:v:0 -map 1:a:0 -c:v h264_nvenc -pix_fmt yuv420p -c:a aac -b:a 128k -shortest video.mp4

## 2. EXTRACT UPTO 10 SECONDS (IF AVAILABLE) OF $VIDEO_CLIP
ffmpeg -ss 3 -y -i $VIDEO_CLIP -t 15 -an -vf "fps=22,format=yuv420p" -c:v libaom-av1 -still-picture 0 -crf 48 -b:v 0 -cpu-used 8 -row-mt 1 -f avif cover.avif

## 3. SAVE TEXT KEY to text.md


## 4. PLACE files IN A DIRECTORY where completed tasks tranditionally go to
