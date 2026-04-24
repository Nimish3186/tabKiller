// Mock Chrome API for local testing
window.chrome = {
  tabs: {
    query: (queryInfo, callback) => {
      setTimeout(() => {
        callback([
          { id: 1, title: 'GitHub - Tab Killer Repo', url: 'https://github.com/nimish/tabkiller', active: true, pinned: false, favIconUrl: 'https://github.githubassets.com/favicons/favicon.svg' },
          { id: 2, title: 'YouTube - Lo-Fi Beats', url: 'https://youtube.com/watch?v=123', active: false, pinned: false, lastAccessed: Date.now() - 2 * 60 * 60 * 1000, favIconUrl: 'https://www.youtube.com/s/desktop/167098e9/img/favicon.ico' },
          { id: 3, title: 'YouTube - Lo-Fi Beats', url: 'https://youtube.com/watch?v=123', active: false, pinned: false, lastAccessed: Date.now() - 2 * 60 * 60 * 1000, favIconUrl: 'https://www.youtube.com/s/desktop/167098e9/img/favicon.ico' },
          { id: 4, title: 'Google Docs - Project Plan', url: 'https://docs.google.com/document/d/123', active: false, pinned: true, favIconUrl: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico' },
          { id: 5, title: 'StackOverflow - How to build extension', url: 'https://stackoverflow.com/questions/123', active: false, pinned: false, lastAccessed: Date.now() - 10 * 60 * 1000, favIconUrl: 'https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico' }
        ]);
      }, 100);
    },
    remove: (tabIds, callback) => { if (callback) setTimeout(callback, 100); },
    create: (options, callback) => { if (callback) setTimeout(callback, 100); }
  },
  storage: {
    local: {
      get: (keys, callback) => { setTimeout(() => callback({ savedTabs: [], lastSession: [] }), 50); },
      set: (data, callback) => { if (callback) setTimeout(callback, 50); }
    }
  }
};
console.log('Chrome API Mocked successfully.');
