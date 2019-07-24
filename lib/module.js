const { DataStoreQuery, Module, Responder } = require('adapt-authoring-core');
const fs = require('fs');
const lib = require('./lib');
const path = require('path');
const schema = require('../schema/coursebuild.schema');
/**
* @extends {Module}
*/
class Output extends Module {
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

    const r2 = server.root.createChildRouter('builds');
    r2.addRoute({ route: '/:_id*', handlers: { get: this.handleBuildFile() } });
    r2.addMiddleware(server.static(this.getBuildDir(), { index: false }));
    this.app.auth.secureRoute(`${r2.path}/:_id*`, 'get', [`read:builds`]);

    resolve();
  }
  /**
  * Adds a child router with a single getter to the api router
  * @param {String} route String to be used as the API endpoint
  *
  setUpRoute(config) {
    const r = this.app.getModule('server').api.createChildRouter(config.name);
    r.addRoute({
      route: config.route,
      handlers: config.handlers
    });
    Object.keys(config.handlers).forEach(k => {
      this.app.auth.secureRoute(`${r.path}${config.route}`, k, config.scopes[k]);
    });
    return r;
  }
  */

  postbuildHandler(req, res, next) {
    const r = new Responder(res);

    lib.generateBuild({ course: req.params.course })
      .then(d => r.success(d))
      .catch(e => r.error(e));
  }

  handleBuildFile() {
    return async (req, res, next) => {
      const buildId = req.params._id;
      const file = req.params['0'];

      console.log(file);

      const q = new DataStoreQuery({ _id: req.params._id });
      q.type = schema.name;
      try {
        const builds = await lib.retrieveBuilds(q);
        if(builds.length !== 1) throw new Error();
      } catch(e) {
        return next('no matching builds');
      }
      this.serveFile(req, res, next, file || 'index.html');
    };
  }

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

module.exports = Output;
