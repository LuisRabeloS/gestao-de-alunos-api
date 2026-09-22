import request from 'supertest';
import { expect } from 'chai';
import fs from 'node:fs';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { loginAsAdmin, loginAsAluno } from './helpers/auth.js';

const testData = JSON.parse(
  fs.readFileSync(new URL('./fixtures/test-data.json', import.meta.url), 'utf8')
);

describe('Fluxo de autenticação e entrega de trabalho', () => {
  const identificador = Date.now();
  const aluno = {
    ...testData.aluno,
    email: testData.aluno.email.replace('@', `+${identificador}@`),
    matricula: `${testData.aluno.matricula}-${identificador}`,
  };
  const trabalho = { ...testData.trabalho };
  let adminToken;
  let alunoId;

  before(async () => {
    adminToken = await loginAsAdmin(app, testData.admin);
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('deve cadastrar um aluno usando o token de administrador', async () => {
    const resposta = await request(app)
      .post('/api/admin/alunos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(aluno);

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.include({ nome: aluno.nome, email: aluno.email });
    expect(resposta.body).to.not.have.property('senha');
    alunoId = resposta.body.id;
    aluno.id = alunoId;
  });

  it('deve matricular o aluno na disciplina do trabalho', async () => {
    const resposta = await request(app)
      .post(`/api/admin/disciplinas/${testData.disciplinaId}/matriculas`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ alunoId });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.include({ alunoId, disciplinaId: testData.disciplinaId });
  });

  it('deve fazer login como aluno usando o helper de autenticação', async () => {
    const alunoToken = await loginAsAluno(app, aluno);

    expect(alunoToken).to.be.a('string').and.not.empty;
  });

  it('deve registrar a entrega de um trabalho como aluno', async () => {
    const alunoToken = await loginAsAluno(app, aluno);
    const resposta = await request(app)
      .post(`/api/alunos/${alunoId}/trabalhos`)
      .set('Authorization', `Bearer ${alunoToken}`)
      .send({ ...trabalho, disciplinaId: testData.disciplinaId });

    expect(resposta.status).to.equal(201);
    expect(resposta.body).to.include({
      alunoId,
      disciplinaId: testData.disciplinaId,
      titulo: trabalho.titulo,
      status: 'entregue',
    });
  });

  it('deve rejeitar credenciais inválidas', async () => {
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: testData.admin.email, senha: testData.credenciaisInvalidas.senha });

    expect(resposta.status).to.equal(401);
    expect(resposta.body.error).to.equal('E-mail ou senha inválidos.');
  });
});
