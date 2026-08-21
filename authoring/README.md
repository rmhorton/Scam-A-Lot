# Documentation for authoring tools



## Building a playlist

From the top directory of your copy of the repo run this command to generate a playlist of numbered MP3 files from a ShowRunner config file:

```
python tools/export_radio_playlist.py \                               
  docs/configs/radio_show.js \     
  --audio-dir audio \
  --output-dir radio_show_playlist
```

## Building a catalog

Run this command to generate a catalog of the segments specified in a config file, to see how long they are:

```
python tools/song_catalog_builder.py \       
  --audio-dir audio \
  --output-dir catalogs \
  docs/js/config.js docs/configs/radio_show.js
```

You can open the file "show_audio_segments.csv" in a spreadsheet. It is helpful to add a cumulative time column.
