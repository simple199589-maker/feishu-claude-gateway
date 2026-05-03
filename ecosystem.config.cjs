module.exports = {
  apps: [
    {
      name: 'feishu-claude-gateway',
      cwd: '/home/simple/work/python/feishu-claude-gateway',
      script: 'dist/index.js',
      interpreter: '/home/simple/.nvm/versions/node/v20.20.2/bin/node',
      env: {
        NODE_ENV: 'production',
      },
      time: true,
    },
  ],
};
