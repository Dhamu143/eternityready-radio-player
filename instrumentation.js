import IcecastMetadataStats from "icecast-metadata-stats";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { query } = await import("@/lib/db");
    const { getStationsList } = await import("@/app/actions/station");
    const { getArtistImage } = await import("@/app/actions/artist");
    console.log(
      "---------------- Registering Instrumentation Service ----------------"
    );
    setInterval(async () => {
      try {
        const stations = (await getStationsList()).stations;
        for (const station of stations) {
          const statsListener = new IcecastMetadataStats(station.url, {
            onStats: async (stats) => {
              if (stats && stats.icy && stats.icy.StreamTitle) {
                // create a 10 character unique id for the track using the station id and the track name consisting of only numbers and letters
                const trackId = `${station.id}_${stats.icy.StreamTitle.replace(
                  /[^a-zA-Z0-9]/g,
                  ""
                ).substring(0, 10)}`;
                const metaArray = stats.icy.StreamTitle.split(" - ");
                let track = {
                  stationId: station.id,
                  trackId: trackId,
                  artistId: null,
                  title: stats.icy.StreamTitle,
                  trackName:
                    metaArray.length > 1 ? metaArray[1] : stats.icy.StreamTitle,
                  artistName: metaArray.length > 0 ? metaArray[0] : "",
                  trackViewUrl: null,
                  artworkURL: null,
                  artistImage: null,
                };

                const searchText = stats.icy.StreamTitle;
                const encodedSearchText = encodeURIComponent(searchText);
                const iTunesSearchURL = `https://itunes.apple.com/search?term=${encodedSearchText}&limit=1`;
                const response = await fetch(iTunesSearchURL);
                const json = await response.json();
                const trackData = json.results[0];
                if (trackData) {
                  track = {
                    ...track,
                    ...{
                      stationId: station.id,
                      trackId: trackData.trackId,
                      artistId: trackData.artistId,
                      trackName: trackData.trackName,
                      artistName: trackData.artistName,
                      trackViewUrl: trackData.trackViewUrl,
                      artworkURL: trackData.artworkUrl100.replace(
                        "100x100",
                        "600x600"
                      ),
                    },
                  };
                  // store the track in the database if not already stored for this station by this trackId
                  const sql = `SELECT * FROM tracks WHERE stationId = ? AND trackId = ?`;
                  const params = [station.id, track.trackId];
                  const rows = await query(sql, params);
                  if (rows.length === 0) {
                    const sql = `INSERT INTO tracks (stationId, trackId, artistId, trackName, artistName, trackViewUrl, artworkURL) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                    const params = [
                      track.stationId,
                      track.trackId,
                      track.artistId || 0,
                      track.trackName,
                      track.artistName,
                      track.trackViewUrl,
                      track.artworkURL,
                    ];
                    await query(sql, params);
                  }

                  if (trackData.artistId && trackData.artistViewUrl) {
                    let artistImage = await getArtistImage(
                      trackData.artistId,
                      trackData.artistViewUrl
                    );
                    track = {
                      ...track,
                      ...{ artistImage: artistImage?.image || null },
                    };
                  }
                }

                // Insert the track into the database table 'playing' or update the existing record
                let currentPlaying = await query(
                  `SELECT * FROM playing WHERE stationId = ?`,
                  [station.id]
                );
                if (currentPlaying.length > 0) {
                  currentPlaying = currentPlaying[0];
                  if (
                    currentPlaying.trackId === track.trackId &&
                    currentPlaying.artistId === track.artistId
                  ) {
                    return;
                  }

                  // Update the track in the database
                  const sql = `UPDATE playing SET trackId = ?, artistId = ?, title = ?, trackName = ?, artistName = ?, trackViewUrl = ?, artworkURL = ?, artistImage = ? WHERE stationId = ?`;
                  const params = [
                    track.trackId,
                    track.artistId || 0,
                    track.title,
                    track.trackName,
                    track.artistName,
                    track.trackViewUrl,
                    track.artworkURL,
                    track.artistImage,
                    station.id,
                  ];
                  await query(sql, params);
                } else {
                  // Insert the track into the database
                  const sql = `INSERT INTO playing (stationId, trackId, artistId, title, trackName, artistName, trackViewUrl, artworkURL, artistImage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                  const params = [
                    track.stationId,
                    track.trackId,
                    track.artistId || 0,
                    track.title,
                    track.trackName,
                    track.artistName,
                    track.trackViewUrl,
                    track.artworkURL,
                    track.artistImage,
                  ];
                  await query(sql, params);
                }

                console.log(trackData ? 1 : 0, stats.icy.StreamTitle);
              }
              statsListener.stop();
            },
            interval: 20,
            sources: ["icy", "ogg"],
          });
          statsListener.start();
          // Clean up track table by only keeping the last 5 tracks for each station
          const sql = `DELETE FROM tracks WHERE id NOT IN (SELECT id FROM (SELECT id FROM tracks WHERE stationId = ? ORDER BY id DESC LIMIT 5) AS t) AND stationId = ?`;
          const params = [station.id, station.id];
          await query(sql, params);
        }
      } catch (error) {
        console.error("Error fetching stations:", error);
      }
    }, 20000);
  }
}
