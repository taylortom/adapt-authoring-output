module.exports = {
  name: 'coursebuild',
  definition: {
    course: {
      type: 'ObjectId',
      required: true
    },
    dir: {
      type: 'String',
      required: true
    },
    createdAt: {
      type: 'Date',
      default: Date.now
    }
  }
};
