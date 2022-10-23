const fs = require('fs');
const path = require('path');
const expect = require('chai').expect;

const {parseSession} = require('../lib');

describe('Schema test', function() {
  it('should accept a valid schema', function() {
    const inputJSON = fs.readFileSync(path.join(__dirname, 'assets/valid_definition.json'), {encoding: 'utf-8'});
    let def;
    expect(def = parseSession(inputJSON)).to.not.throw;
    expect(def.title).to.have.string('This is ok');
  });

  it('should accept the schema in te examples folder (sbk_session.json)', function() {
    const inputJSON = fs.readFileSync(path.join(__dirname, '../examples/sbk_session.json'), {encoding: 'utf-8'});
    let def;
    expect(def = parseSession(inputJSON)).to.not.throw;
    expect(def.title).to.have.string('My awesome');
  });

  it('should accept the schema in te examples folder (swing_session.json)', function() {
    const inputJSON = fs.readFileSync(path.join(__dirname, '../examples/swing_session.json'), {encoding: 'utf-8'});
    let def;
    expect(def = parseSession(inputJSON)).to.not.throw;
    expect(def.title).to.have.string('Blues');
  });

  it('should reject an invalid schema', function() {
    const inputJSON = fs.readFileSync(path.join(__dirname, 'assets/invalid_definition.json'), {encoding: 'utf-8'});
    expect(() => parseSession(inputJSON)).to.throw(Error);
  });
});
