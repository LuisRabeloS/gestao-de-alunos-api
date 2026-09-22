import { expect } from 'chai';
import request from 'supertest';

export async function loginAsAdmin(app, credenciais) {
  const resposta = await request(app)
    .post('/api/auth/login')
    .send(credenciais);

  expect(resposta.status).to.equal(200);
  expect(resposta.body).to.have.property('token').that.is.a('string');
  return resposta.body.token;
}

export async function loginAsAluno(app, aluno) {
  const resposta = await request(app)
    .post('/api/auth/login')
    .send({ email: aluno.email, senha: aluno.senha });

  expect(resposta.status).to.equal(200);
  expect(resposta.body.usuario).to.include({ id: aluno.id, role: 'aluno' });
  return resposta.body.token;
}