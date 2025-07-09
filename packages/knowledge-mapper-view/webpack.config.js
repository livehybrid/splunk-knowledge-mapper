const path = require('path');
const { merge: webpackMerge } = require('webpack-merge');
const baseComponentConfig = require('@splunk/webpack-configs/component.config').default;

module.exports = webpackMerge(baseComponentConfig, {
    entry: {
        KnowledgeMapperView: path.join(__dirname, 'src/KnowledgeMapperView.jsx'),
    },
    output: {
        path: path.join(__dirname),
    },
});
