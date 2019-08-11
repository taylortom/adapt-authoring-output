const { DataStoreQuery, Module, Responder } = require('adapt-authoring-core');
const fs = require('fs');
const lib = require('./lib');
const path = require('path');
const schema = require('../schema/coursebuild.schema');
/**
* @extends {Module}
* Module to handle Adapt framework course output
*/
class OutputModule extends Module {
  /**
  * Returns the directory in which course builds are stored
  * @param {...String} extras Extra path segments to append to the build directory
  * @return {String}
  */
  getBuildDir(...extras) {
    return path.join(this.app.getConfig('temp_dir'), 'builds', ...extras);
  }
  /** @override */
  preload(app, resolve, reject) {
    const mongodb = this.app.getModule('mongodb');
    const server = this.app.getModule('server');

    mongodb.on('boot', db => db.addModel({ name: schema.name, schema: schema.definition }));

    const r1 = server.api.createChildRouter('build');
    r1.addRoute({ route: '/:course', handlers: { post: this.postbuildHandler } });
    this.app.auth.secureRoute(`/api/build/:course`, 'post', [`write:builds`]);

    const r2 = server.api.createChildRouter('builds');
    r2.addRoute({ route: '/:_id?', handlers: { get: this.retrieveBuildsHandler } });
    this.app.auth.secureRoute(`/api/builds/:_id?`, 'get', ['read:builds']);

    const r3 = server.root.createChildRouter('servebuild');
    r3.addRoute({ route: '/:_id*', handlers: { get: this.serveBuildHandler() } });
    r3.addMiddleware(server.static(this.getBuildDir(), { index: false }));
    this.app.auth.unsecureRoute(`/servebuild/:_id*`, 'get');

    resolve();
  }
  /**
  * Handler for POST requests
  * @param {ClientRequest} req
  * @param {ServerResponse} res
  * @param {Function} next
  */
  postbuildHandler(req, res, next) {
    const r = new Responder(res);
    lib.generateBuild({ course: req.params.course })
      .then(d => r.success(d))
      .catch(e => r.error(e));
  }
  /**
  * Handler for GET requests
  * @param {ClientRequest} req
  * @param {ServerResponse} res
  * @param {Function} next
  */
  retrieveBuildsHandler(req, res, next) {
    const r = new Responder(res);
    req.type = schema.name;

    lib.retrieveBuilds(DataStoreQuery.fromRequest(req))
      .then(d => {
        if(!req.params._id) {
          return r.success(d);
        }
        if(d.length !== 1) {
          return r.error(new Error(`build doesn't exist`), { statusCode: 404 });
        }
        r.success(d[0]);
      })
      .catch(e => r.error(e));
  }
  /**
  * Serves a single HTML build
  * @return {Function} Middleware handler
  */
  serveBuildHandler() {
    return async (req, res, next) => {
      const buildId = req.params._id;
      const file = req.params['0'];
      const q = new DataStoreQuery({ type: schema.name, _id: req.params._id });

      try {
        const builds = await lib.retrieveBuilds(q);
        if(builds.length !== 1) throw new Error();
      } catch(e) {
        return next('no matching builds');
      }
      this.serveFile(req, res, next, file || 'index.html');
    };
  }
  /**
  * Serves a single file
  * @param {ClientRequest} req
  * @param {ServerResponse} res
  * @param {Function} next
  * @param {String} file File to serve
  */
  serveFile(req, res, next, file) {
    const filepath = this.getBuildDir(req.params._id, file);
    try {
      // fs.statSync(filepath);
      res.sendFile(filepath);
    } catch(e) {
      this.log('warn', `cannot serve '${file}', it doesn't exist`);
      return next();
    }
  }
}

module.exports = OutputModule;
