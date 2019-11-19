const should = require('should');

describe('plugin.echo', function() {    
    it('should return same text', async function() {
        let response = await this.bot.receive(this.builder.text('echo Test').build());
        response.text.should.be.equal('Test');
    });
});