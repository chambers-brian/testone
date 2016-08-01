import gulp from 'gulp';
import connect from 'gulp-connect';
import chalk from 'chalk';
import sass from 'gulp-sass';
import browserify from 'browserify';
import webpackStream from 'webpack-stream';
import webpack from 'webpack';
import watchify from 'watchify';
import babelify from 'babelify';
import gutil from 'gulp-util';
import buffer from 'vinyl-buffer';
import source from 'vinyl-source-stream';
import sourcemaps from 'gulp-sourcemaps';
import uglify from 'gulp-uglify';
import rename from 'gulp-rename';
import del from 'del';
import vinylPaths from 'vinyl-paths';
import replace from 'gulp-replace';
import gulpif from 'gulp-if';
import cssNano from 'gulp-cssnano';
import merge from 'merge-stream';
import git from 'gulp-git';
import header from 'gulp-header';
import moment from 'moment-timezone';
import mocha from 'gulp-mocha';

// for debugging webpack
// import StatsPlugin from 'stats-webpack-plugin';

// Base Directories
const dir = {
    BASE: './',
    PUBLIC: './public',
    SRC: './src',
    TEST: './__tests__'
};

// Path constants
const path = {
    MINIFIED_OUT: 'app.min.js',
    OUT: 'app.js',
    ENTRY_POINT: dir.SRC + '/js/app.jsx',
    INDEX_SRC: 'index.html',
    SASS_SRC: dir.SRC + '/_scss/**',

    PROD_CONSTANTS: 'GlobalConstants_prod.js',
    DEV_CONSTANTS: 'GlobalConstants_dev.js',
    LOCAL_CONSTANTS: 'GlobalConstants_local.js'
};

let minified = false;

const environmentTypes = {
    DEVLOCAL: 0,
    DEVHOSTED: 1,
    PROD: 2,
    LOCAL: 3
};

const serverDeps = [];

let commitHash = '';
let coreHash = '';
const currentTime = moment().tz('America/New_York').format('MMMM D, YYYY h:mm A z');

// set the environment
let environment = environmentTypes.DEVLOCAL;
process.env.NODE_ENV = 'development';

gulp.task('setDev', () => {
    minified = false;
    environment = environmentTypes.DEVLOCAL;

    // set the NodeJS environment so that Redux compiles correctly in production modes
    process.env.NODE_ENV = 'development';

    gutil.log('You are running in ' + chalk.black.bgYellow(' DEVELOPMENT (LOCAL) ') + ' mode.');
});

gulp.task('setDevHosted', () => {
    minified = false;
    environment = environmentTypes.DEVHOSTED;
    process.env.NODE_ENV = 'development';

    gutil.log('You are running in ' + chalk.black.bgYellow(' DEVELOPMENT (HOSTED) ') + ' mode.');
})

gulp.task('setProd', () => {
    minified = true;
    environment = environmentTypes.PROD;
    process.env.NODE_ENV = 'production';

    gutil.log('You are running in ' + chalk.black.bgGreen(' PRODUCTION (HOSTED) ') + ' mode.');
});

gulp.task('setLocal', () => {
    minified = true;
    environment = environmentTypes.LOCAL;
    process.env.NODE_ENV = 'production';

    // update the local server dependencies to wait for the minification and HTML modification process
    serverDeps.push('modifyHtml');

    gutil.log('You are running in ' + chalk.black.bgGreen(' PRODUCTION (LOCAL) ') + ' mode.');
});

// clear out the existing folder contents and also the webpack build cache
// NOTE: this will make the build take a long time
gulp.task('clean', () => {
    return del([dir.PUBLIC + '/**/*', './cache/**/*']);
});

// get the current git metadata
gulp.task('meta', ['clean'], (done) => {
    git.revParse({
        args: '--short HEAD',
        quiet: true
    }, (err, hash) => {
        commitHash = hash;
        gutil.log('This build is based on commit ' + chalk.cyan(hash) + '.');
        done();
    });
});

// copy the correct constants file into the source directory
gulp.task('copyConstants', ['meta'], () => {

    let file = path.DEV_CONSTANTS;

    if (environment == environmentTypes.PROD) {
        file = path.PROD_CONSTANTS;
    }
    else if (environment == environmentTypes.LOCAL) {
        file = path.LOCAL_CONSTANTS;
    }

    return gulp.src('./' + file)
        .pipe(rename('GlobalConstants.js'))
        .pipe(gulp.dest(dir.SRC + '/js'))
        .on('end', () => {
            gutil.log('Using ' + chalk.magenta(file) + ' as the constants file...');
        });
});

// copy the assets
gulp.task('copyAssets', ['copyConstants'], () => {

    // determine the destination
    const destination = dir.PUBLIC;

    // combine all the copy streams into a single stream
    // return the stream to wait for the task to complete
    return merge(
        // copy fonts
        gulp.src(dir.SRC + '/fonts/**/*')
            .pipe(gulp.dest(dir.PUBLIC + '/fonts'))
            .on('end', () => {
                gutil.log('Fonts copied');
            }),

        // copy graphics
        gulp.src(dir.SRC + '/graphics/**/*')
            .pipe(gulp.dest(dir.PUBLIC + '/graphics'))
            .on('end', () => {
                gutil.log('Graphics copied');
            }),

         // copy images
        gulp.src(dir.SRC + '/img/**/*')
            .pipe(gulp.dest(dir.PUBLIC + '/img'))
            .on('end', () => {
                gutil.log('Images copied');
            }),

        // copy CSS files
        gulp.src(dir.SRC + '/css/**/*.css')
            .pipe(gulp.dest(dir.PUBLIC + '/css'))
            .on('end', () => {
                gutil.log('CSS copied');
            }),

        // copy markdown files
        gulp.src(dir.SRC + '/help/**/*.md')
            .pipe(gulp.dest(dir.PUBLIC + '/help'))
            .on('end', () => {
                gutil.log('Markdown copied');
            }),

        // copy the main index file
        gulp.src('./index.html')
            .pipe(gulp.dest(dir.PUBLIC))
            .on('end', () => {
                gutil.log('index.html copied');
            })
    );
});

// build the SASS
gulp.task('sass', ['copyAssets'], () => {

    if (environment == environmentTypes.DEVLOCAL) {
        // set up a watcher for future SASS changes
        gulp.watch([dir.SRC + '/css/**/*.scss', dir.SRC + '/_scss/**/*.scss'])
            .on('change', () => {
                gutil.log(chalk.green('Starting SASS recompile...'));
                return gulp.src(dir.SRC + '/css/**/*.scss')
                    .pipe(sass.sync().on('error', sass.logError))
                    .pipe(gulp.dest(dir.PUBLIC + '/css'))
                    // auto reload the browser
                    .pipe(connect.reload())
                    .on('end', () => {
                        gutil.log(chalk.green('SASS compiled.'));
                    });
            });
    }

    // compile SASS files
    return gulp.src(dir.SRC + '/css/**/*.scss')
        .pipe(sass.sync().on('error', sass.logError))
        // add in the commit hash and timestamp header
        .pipe(header('/* Build ' + commitHash  + '\n' + currentTime + ' */\n\n'))
        // .pipe(gulpif(minified, cssNano()))
        .pipe(gulp.dest(dir.PUBLIC + '/css'));
});

gulp.task('webpackCore', ['sass'], (callback) => {

    const config = {
        entry: {
            'core': ['react', 'react-dom', 'q', 'react-addons-css-transition-group', 'react-router', 'superagent', 'redux', 'lodash', 'jquery', 'moment', 'svg4everybody', 'dompurify', 'aws-sdk']
        },
        output: {
            path: './public/js',
            publicPath: 'js/',
            filename: 'core.js',
            library: '[name]_[hash]'
        },
        module: {
            loaders: [{
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loader: 'babel-loader'
            },{
                test: /\.json$/,
                loader: 'json-loader'
            },{
                test: /\/node_modules\/aws-sdk/,
                loader: 'transform?aws-sdk/dist-tools/transform'
            }]
        },
        node: {
            fs: "empty"
        },
        plugins: [
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
            }),
            new webpack.DllPlugin({
                path: './public/js/manifest.json',
                name: '[name]_[hash]',
                context: '.'
            }),
            new webpack.optimize.DedupePlugin()
        ]
    };

    // only minify if not local development
    if (environment != environmentTypes.DEVLOCAL) {
        config.plugins.push(new webpack.optimize.UglifyJsPlugin({
            compress: true,
            warnings: false,
            sourceMap: false
        }));

        // also use a hashed file name (based on content, not commit)
        config.output.filename = 'core.[hash].js';
    }

    webpack(config, (err, stats) => {
        coreHash = stats.hash;
        if(err) throw new gutil.PluginError("webpack", err);
        callback();
    });
});

gulp.task('webpack', ['webpackCore'], () => {
    const jsFile = 'app.' + commitHash + '.js';

    const config = {
        output: {
            publicPath: 'js/',
            filename: 'app.js',
            chunkFilename: 'chunk.[chunkhash].js'
        },
        module: {
            loaders: [{
                test: /\.jsx?$/,
                include: /src\/js/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                query: {
                    cacheDirectory: './cache/',
                    compact: true
                }
            },{
                test: /\.json$/,
                loader: 'json-loader'
            },{
                test: /\/node_modules\/aws-sdk/,
                loader: 'transform?aws-sdk/dist-tools/transform'
            }],
            noParse: [
                /\src\/js\/vendor\/aws\-sdk\-s3\-only.js$/
            ]
        },
        node: {
            fs: "empty"
        },
        plugins: [
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
            }),
            new webpack.DllReferencePlugin({
                context: '.',
                manifest: require('./public/js/manifest.json')
            })
        ]
    };

    // watch if in local dev mode
    if (environment == environmentTypes.DEVLOCAL) {

        // enable debugging on the JS output
        config.devtool = 'eval';
        config.debug = true;

        gulp.watch('./src/js/**/*')
            .on('change', () => {
                const watchConfig = Object.assign(config, {quiet: true});
                return gulp.src(path.ENTRY_POINT)
                    .pipe(sourcemaps.init())
                    .pipe(webpackStream(watchConfig))
                    .pipe(gulp.dest('./public/js'))
                    .pipe(connect.reload())
                    .on('end', (err, stats) => {
                        gutil.log(chalk.cyan('Reloading JS...'));
                    })
                    .on('error', (err) => {
                        console.log("ERROR");
                        console.log(err);
                    });
            });
    }
    else if (environment != environmentTypes.DEVHOSTED) {
        // if it's not a development environment, minify everything
        config.plugins.push(new webpack.optimize.UglifyJsPlugin({
            compress: true,
            warnings: false,
            sourceMap: false
        }));

        // use the commit hash to version the app.js file
        config.output.filename = jsFile;
    }
    else {
        // even in the hosted environment, use the commit hash
        config.output.filename = jsFile;
    }

    return gulp.src(path.ENTRY_POINT)
        .pipe(sourcemaps.init())
        .pipe(webpackStream(config))
        .pipe(gulp.dest('./public/js'))
        .pipe(connect.reload())
        .on('end', () => {
            gutil.log(chalk.cyan('Reloading JS...'));
        });

});


// after minifying, change the HTML script tag to point to the minified file
gulp.task('modifyHtml', ['webpack'], () => {
    const cssFile = 'main.' + commitHash + '.css';
    const jsFile = 'app.' + commitHash + '.js';
    const coreFile = 'core.' + coreHash + '.js';

    return merge(
        gulp.src(dir.PUBLIC + '/index.html')
            // replace the app.js script reference with one that points to the minified file
            // add in a ?v=[git hash] param to override browser caches when a new version is deployed
            .pipe(replace(path.OUT, jsFile))
            .pipe(replace('core.js', coreFile))
            // now do the same thing (without minification) for the CSS file
            .pipe(replace('main.css', cssFile))
            .pipe(gulp.dest(dir.PUBLIC)),
        // now we have to rename the CSS file to match (JS renaming is handled by minification process)
        gulp.src(dir.PUBLIC + '/css/main.css')
            .pipe(vinylPaths(del))
            .pipe(rename(cssFile))
            .pipe(gulp.dest(dir.PUBLIC + '/css'))
    );
});


// serve the frontend locally
gulp.task('serve', serverDeps, () => {

    let reload = true;
    if (environment != environmentTypes.DEVLOCAL) {
        reload = false;
    }

    connect.server({
        root: dir.PUBLIC,
        port: 3000,
        livereload: reload
    });
});


// user-initiated gulp tasks
gulp.task('buildDev', ['setDevHosted', 'modifyHtml'], () => {
    
});

gulp.task('dev', ['setDev', 'webpack', 'serve'], () => {
    
});

gulp.task('buildLocal', ['setLocal', 'modifyHtml'], () => {

});

gulp.task('local', ['setLocal', 'modifyHtml', 'serve'], () => {

});

gulp.task('production', ['setProd', 'modifyHtml'], () => {
    
});

gulp.task('default', ['local']);



// run unit tests
gulp.task('expresso', () => {
    return gulp.src(['./__unittests__/**/*-spec.js','./__unittests__/**/*-spec.jsx', '!./__unittests__/support/*.js'], { read: false })
        .pipe(mocha({
            compilers: {
                js: require('babel-core/register')
            },
            require: ['./__unittests__/setup.js']
        }))
})

gulp.task('mocha', () => {
    return gulp.src(['./__unittests__/**/*-spec.js','./__unittests__/**/*-spec.jsx', '!./__unittests__/support/*.js'], { read: false })
        .pipe(mocha({
            compilers: {
                js: require('babel-core/register')
            },
            require: ['./__unittests__/setup.js'],
            reporter: 'mocha-junit-reporter',
            reporterOptions: {
                mochaFile: './__unittests__/mocha.xml'
            }
        }))
})
