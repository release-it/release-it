import shelljs from 'shelljs';
import nock from 'nock';

shelljs.config.silent = true;
nock.disableNetConnect();
