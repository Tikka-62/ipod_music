if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('./sw.js').catch(function(err) {
          console.log('SW登録失敗かも', err);
        });
      });
    }

    var iconPlay = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
    var iconPause = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    var audioPlayer = document.getElementById('audioPlayer');
    var miniPlayer = document.getElementById('miniPlayer');
    var artworkImage = document.getElementById('artworkImage');
    var artworkFallback = document.getElementById('artworkFallback');

    var colors = ['#fa233b', '#ff9500', '#ffcc00', '#34c759', '#5ac8fa', '#007aff', '#af52de', '#ff2d55'];
    var colorPicker = document.getElementById('colorPicker');
    var savedTheme = localStorage.getItem('theme');
    var savedColor = localStorage.getItem('accentColor');
    var appTags = JSON.parse(localStorage.getItem('appTags')) || ['朝', '読書'];
    
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      document.getElementById('darkModeToggle').checked = true;
    }
    if (savedColor) {
      document.documentElement.style.setProperty('--accent-color', savedColor);
    } else {
      savedColor = colors[0];
    }

    document.getElementById('darkModeToggle').addEventListener('change', function(e) {
      if (e.target.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
      }
    });

    colors.forEach(function(color) {
      var btn = document.createElement('button');
      btn.className = 'color-btn';
      btn.style.backgroundColor = color;
      if (color === savedColor) btn.classList.add('active');
      
      btn.addEventListener('click', function() {
        document.querySelectorAll('.color-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        document.documentElement.style.setProperty('--accent-color', color);
        localStorage.setItem('accentColor', color);
      });
      colorPicker.appendChild(btn);
    });

    var addTagModeBtn = document.getElementById('addTagModeBtn');
    var deleteTagModeBtn = document.getElementById('deleteTagModeBtn');
    var addTagSection = document.getElementById('addTagSection');
    var deleteTagSection = document.getElementById('deleteTagSection');

    addTagModeBtn.addEventListener('click', function() {
      addTagModeBtn.classList.add('active-action');
      deleteTagModeBtn.classList.remove('active-action');
      addTagSection.style.display = 'flex';
      deleteTagSection.style.display = 'none';
    });

    deleteTagModeBtn.addEventListener('click', function() {
      deleteTagModeBtn.classList.add('active-action');
      addTagModeBtn.classList.remove('active-action');
      addTagSection.style.display = 'none';
      deleteTagSection.style.display = 'block';
      renderSettingsTags();
    });

    function saveTags() {
      localStorage.setItem('appTags', JSON.stringify(appTags));
    }

    function renderSettingsTags() {
      var list = document.getElementById('settingsTagList');
      list.innerHTML = '';
      if(appTags.length === 0) {
        list.innerHTML = '<p style="color: var(--secondary-text);">タグがないよ。</p>';
        return;
      }
      appTags.forEach(function(tag, index) {
        var row = document.createElement('div');
        row.className = 'tag-list-item';
        
        var name = document.createElement('span');
        name.textContent = tag;
        
        var delBtn = document.createElement('span');
        delBtn.textContent = '削除';
        delBtn.style.color = '#ff3b30';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontSize = '14px';
        delBtn.style.fontWeight = 'bold';
        delBtn.onclick = function() {
          appTags.splice(index, 1);
          saveTags();
          renderSettingsTags();
          renderPlaylist();
          if(currentIndex >= 0) updatePlayerTags();
        };
        
        row.appendChild(name);
        row.appendChild(delBtn);
        list.appendChild(row);
      });
    }

    document.getElementById('addTagSubmitBtn').addEventListener('click', function() {
      var input = document.getElementById('newTagInput');
      var val = input.value.trim();
      if(val && !appTags.includes(val)) {
        appTags.push(val);
        saveTags();
        input.value = '';
        renderPlaylist();
        if(currentIndex >= 0) updatePlayerTags();
      }
    });

    var db;
    var currentSongs = [];
    var currentIndex = -1;
    var isShuffle = false;
    var isRepeat = false;
    
    var playPauseBtn = document.getElementById('playPauseBtn');
    var shuffleBtn = document.getElementById('shuffleBtn');
    var repeatBtn = document.getElementById('repeatBtn');
    var progressBar = document.getElementById('progressBar');
    var timeDisplay = document.getElementById('timeDisplay');
    var nowPlaying = document.getElementById('nowPlaying');

    var dbRequest = indexedDB.open("MusicPlayerDB_v2", 1);

    dbRequest.onupgradeneeded = function(e) {
      db = e.target.result;
      db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
    };

    dbRequest.onsuccess = function(e) {
      db = e.target.result;
      displaySongs();
    };

    function switchTab(e, tabId) {
      document.querySelectorAll('.screen').forEach(function(el) {
        el.classList.remove('active');
      });
      document.querySelectorAll('.tab').forEach(function(el) {
        el.classList.remove('active');
      });
      document.getElementById(tabId).classList.add('active');
      
      if (e) {
        e.currentTarget.classList.add('active');
      } else {
        var tabElement = document.getElementById('tab-' + tabId);
        if(tabElement) tabElement.classList.add('active');
      }

      if (tabId === 'playlist') {
        document.getElementById('playlistTagListView').style.display = 'block';
        document.getElementById('playlistSongListView').style.display = 'none';
      }

      if (tabId === 'settings' || tabId === 'deleteScreen') {
        document.querySelector('.tab-bar').style.display = 'none';
        miniPlayer.style.display = 'none';
      } else {
        document.querySelector('.tab-bar').style.display = 'flex';
        if (audioPlayer.src) {
          miniPlayer.style.display = 'block';
        }
      }
    }

    function showSettings() {
      switchTab(null, 'settings');
    }

    function showLibrary() {
      switchTab(null, 'library');
    }

    document.getElementById('goToSettingsBtn').addEventListener('click', showSettings);
    document.getElementById('goToSettingsBtnFromPlaylist').addEventListener('click', showSettings);
    
    document.getElementById('backToLibraryBtn').addEventListener('click', showLibrary);
    document.getElementById('backToSettingsFromDeleteBtn').addEventListener('click', showSettings);
    document.getElementById('backToTagListBtn').addEventListener('click', function() {
      document.getElementById('playlistTagListView').style.display = 'block';
      document.getElementById('playlistSongListView').style.display = 'none';
    });

    document.getElementById('fileInput').addEventListener('change', async function(e) {
      if (!db) return;
      var files = e.target.files;
      if (files.length === 0) return;

      var statusMsg = document.getElementById('statusMsg');
      statusMsg.textContent = '読み込み中...少し待っててね';
      var songsToSave = [];

      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var ext = file.name.split('.').pop().toLowerCase();
        
        if (ext !== 'mp3' && ext !== 'wav' && ext !== 'zip') continue;
        
        if (ext === 'zip') {
          try {
            var zip = await JSZip.loadAsync(file);
            for (var filename in zip.files) {
              var zipEntry = zip.files[filename];
              if (!zipEntry.dir && (filename.toLowerCase().endsWith('.mp3') || filename.toLowerCase().endsWith('.wav'))) {
                var arrayBuffer = await zipEntry.async("arraybuffer");
                var type = filename.toLowerCase().endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
                var cleanName = filename.split('/').pop().replace(/\.[^/.]+$/, "");
                
                if (!cleanName.startsWith('._')) {
                  songsToSave.push({
                    name: cleanName,
                    type: type,
                    data: arrayBuffer,
                    tags: []
                  });
                }
              }
            }
          } catch(err) {
            console.error('Zip解凍エラー', err);
          }
        } else {
          await new Promise(function(resolve) {
            var fileReader = new FileReader();
            fileReader.onload = function(event) {
              songsToSave.push({
                name: file.name.replace(/\.[^/.]+$/, ""),
                type: file.type || 'audio/mpeg',
                data: event.target.result,
                tags: []
              });
              resolve();
            };
            fileReader.readAsArrayBuffer(file);
          });
        }
      }

      var transaction = db.transaction(["songs"], "readwrite");
      var store = transaction.objectStore("songs");
      
      songsToSave.forEach(function(songData) {
        store.add(songData);
      });

      transaction.oncomplete = function() {
        statusMsg.textContent = '';
        displaySongs();
        showLibrary();
        e.target.value = '';
      };
    });

    function displaySongs() {
      var songList = document.getElementById('songList');
      songList.innerHTML = '';
      currentSongs = [];

      var transaction = db.transaction(["songs"], "readonly");
      var store = transaction.objectStore("songs");
      var request = store.openCursor();

      request.onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) {
          currentSongs.push(cursor.value);
          
          var div = document.createElement('div');
          div.className = 'song-item';
          
          var nameSpan = document.createElement('span');
          nameSpan.textContent = cursor.value.name;
          div.appendChild(nameSpan);
          
          let index = currentSongs.length - 1;
          div.addEventListener('click', function() {
            playSong(index);
          });

          songList.appendChild(div);
          cursor.continue();
        } else {
          if (songList.innerHTML === '') {
            songList.innerHTML = '<p style="color: var(--secondary-text);">曲がありません。設定から追加してね。</p>';
          }
          renderPlaylist();
        }
      };
    }
    
    document.getElementById('deleteAllBtn').addEventListener('click', function() {
      if (confirm('本当に全部の曲を消してもいいのかな？')) {
        var transaction = db.transaction(["songs"], "readwrite");
        var store = transaction.objectStore("songs");
        store.clear().onsuccess = function() {
          currentSongs = [];
          currentIndex = -1;
          audioPlayer.pause();
          audioPlayer.src = '';
          nowPlaying.textContent = '曲が選択されていません';
          miniPlayer.style.display = 'none';
          displaySongs();
        };
      }
    });

    document.getElementById('selectDeleteBtn').addEventListener('click', function() {
      switchTab(null, 'deleteScreen');
      var container = document.getElementById('deleteSongList');
      container.innerHTML = '';
      
      if(currentSongs.length === 0) {
        container.innerHTML = '<p style="color: var(--secondary-text);">消せる曲がないよ。</p>';
        return;
      }
      
      currentSongs.forEach(function(song) {
        var div = document.createElement('div');
        div.className = 'song-item';
        
        var label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.width = '100%';
        label.style.cursor = 'pointer';
        
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'song-checkbox';
        cb.value = song.id;
        
        var nameSpan = document.createElement('span');
        nameSpan.textContent = song.name;
        
        label.appendChild(cb);
        label.appendChild(nameSpan);
        div.appendChild(label);
        container.appendChild(div);
      });
    });

    document.getElementById('executeDeleteBtn').addEventListener('click', function() {
      var checkboxes = document.querySelectorAll('.song-checkbox:checked');
      if (checkboxes.length === 0) return;
      
      if (confirm(checkboxes.length + '曲を消すけどいいかな？')) {
        var transaction = db.transaction(["songs"], "readwrite");
        var store = transaction.objectStore("songs");
        
        checkboxes.forEach(function(cb) {
          store.delete(Number(cb.value));
        });
        
        transaction.oncomplete = function() {
          displaySongs();
          showSettings();
        };
      }
    });

    function renderPlaylist() {
      var listContainer = document.getElementById('playlistTagList');
      listContainer.innerHTML = '';
      
      if (appTags.length === 0) {
        listContainer.innerHTML = '<p style="color: var(--secondary-text);">タグがありません。設定から追加してね。</p>';
        return;
      }
      
      appTags.forEach(function(tag) {
        var div = document.createElement('div');
        div.className = 'song-item';
        
        var nameSpan = document.createElement('span');
        nameSpan.textContent = tag;
        div.appendChild(nameSpan);
        
        var arrowSpan = document.createElement('span');
        arrowSpan.style.color = 'var(--secondary-text)';
        arrowSpan.textContent = '＞';
        div.appendChild(arrowSpan);
        
        div.addEventListener('click', function() {
          showPlaylistSongs(tag);
        });
        
        listContainer.appendChild(div);
      });
    }

    function showPlaylistSongs(tag) {
      document.getElementById('playlistTagListView').style.display = 'none';
      document.getElementById('playlistSongListView').style.display = 'block';
      document.getElementById('currentPlaylistTitle').textContent = tag;
      
      var songListContainer = document.getElementById('playlistSongList');
      songListContainer.innerHTML = '';
      
      var matches = currentSongs.filter(function(s) { return s.tags && s.tags.includes(tag); });
      
      if (matches.length === 0) {
        songListContainer.innerHTML = '<p style="color: var(--secondary-text);">このタグが付いた曲はありません。</p>';
        return;
      }
      
      matches.forEach(function(song) {
        var div = document.createElement('div');
        div.className = 'song-item';
        
        var nameSpan = document.createElement('span');
        nameSpan.textContent = song.name;
        div.appendChild(nameSpan);
        
        let globalIndex = currentSongs.findIndex(function(s) { return s.id === song.id; });
        div.addEventListener('click', function() {
          playSong(globalIndex);
        });
        
        songListContainer.appendChild(div);
      });
    }

    function updatePlayerTags() {
      var container = document.getElementById('playerTags');
      container.innerHTML = '';
      if(currentIndex < 0) return;
      
      var song = currentSongs[currentIndex];
      var songTags = song.tags || [];
      
      appTags.forEach(function(tag) {
        var btn = document.createElement('button');
        btn.className = 'tag-btn' + (songTags.includes(tag) ? ' active' : '');
        btn.textContent = tag;
        btn.onclick = function() {
          if (songTags.includes(tag)) {
            songTags = songTags.filter(function(t) { return t !== tag; });
          } else {
            songTags.push(tag);
          }
          song.tags = songTags;
          
          var transaction = db.transaction(["songs"], "readwrite");
          var store = transaction.objectStore("songs");
          store.put(song);
          transaction.oncomplete = function() {
            updatePlayerTags();
            renderPlaylist();
          };
        };
        container.appendChild(btn);
      });
    }

    function updatePlayPauseIcon(isPlaying) {
      playPauseBtn.innerHTML = isPlaying ? iconPause : iconPlay;
    }

    function playSong(index) {
      if (index < 0 || index >= currentSongs.length) return;
      currentIndex = index;
      var song = currentSongs[currentIndex];
      
      var blob = new Blob([song.data], { type: song.type });
      var url = URL.createObjectURL(blob);
      
      nowPlaying.textContent = song.name;
      
      artworkImage.style.display = 'none';
      artworkFallback.style.display = 'flex';
      updatePlayerTags();

      if (window.jsmediatags) {
        jsmediatags.read(blob, {
          onSuccess: function(tag) {
            if (tag.tags && tag.tags.picture) {
              var picture = tag.tags.picture;
              var artBlob = new Blob([new Uint8Array(picture.data)], {type: picture.format});
              artworkImage.src = URL.createObjectURL(artBlob);
              artworkImage.style.display = 'block';
              artworkFallback.style.display = 'none';
            }
          },
          onError: function(error) {
            console.log('Artwork loading error', error);
          }
        });
      }

      audioPlayer.src = url;
      audioPlayer.play();
      updatePlayPauseIcon(true);
      switchTab(null, 'player');
    }

    function togglePlay() {
      if (audioPlayer.src) {
        if (audioPlayer.paused) {
          audioPlayer.play();
          updatePlayPauseIcon(true);
        } else {
          audioPlayer.pause();
          updatePlayPauseIcon(false);
        }
      }
    }
    
    playPauseBtn.addEventListener('click', togglePlay);

    audioPlayer.addEventListener('timeupdate', function() {
      var current = audioPlayer.currentTime;
      var duration = audioPlayer.duration || 0;
      
      progressBar.max = duration;
      progressBar.value = current;
      
      var curMin = Math.floor(current / 60);
      var curSec = Math.floor(current % 60).toString().padStart(2, '0');
      var durMin = Math.floor(duration / 60) || 0;
      var durSec = Math.floor(duration % 60).toString().padStart(2, '0') || '00';
      
      if (!isNaN(duration)) {
        var text = curMin + ':' + curSec + ' / ' + durMin + ':' + durSec;
        timeDisplay.textContent = text;
      }
    });

    function seekSong(e) {
      if (audioPlayer.src) {
        audioPlayer.currentTime = parseFloat(e.target.value);
      }
    }
    
    progressBar.addEventListener('input', seekSong);

    function playNext() {
      if (currentSongs.length === 0) return;
      if (isRepeat) {
        playSong(currentIndex);
      } else if (isShuffle) {
        var nextIndex = Math.floor(Math.random() * currentSongs.length);
        playSong(nextIndex);
      } else {
        var nextIndex = (currentIndex + 1) % currentSongs.length;
        playSong(nextIndex);
      }
    }

    audioPlayer.addEventListener('ended', playNext);

    function toggleShuffle() {
      isShuffle = !isShuffle;
      shuffleBtn.classList.toggle('active-btn', isShuffle);
      if (isShuffle) {
        isRepeat = false;
        repeatBtn.classList.remove('active-btn');
      }
    }

    shuffleBtn.addEventListener('click', toggleShuffle);

    function toggleRepeat() {
      isRepeat = !isRepeat;
      repeatBtn.classList.toggle('active-btn', isRepeat);
      if (isRepeat) {
        isShuffle = false;
        shuffleBtn.classList.remove('active-btn');
      }
    }

    repeatBtn.addEventListener('click', toggleRepeat);