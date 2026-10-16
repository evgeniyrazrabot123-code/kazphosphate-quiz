from fastapi.testclient import TestClient

from backend import main


client = TestClient(main.app)


def test_admin_question_rejects_mismatched_answer_lists(monkeypatch):
    monkeypatch.setattr(main, "ADMIN_USERNAME", "test-admin")
    monkeypatch.setattr(main, "ADMIN_PASSWORD", "test-password")
    monkeypatch.setattr(main, "ADMIN_TOKEN", "test-token")

    response = client.post(
        "/api/admin/questions",
        headers={"Authorization": "Bearer test-token"},
        data={
            "category": "dumper",
            "text_ru": "Вопрос RU",
            "text_kk": "Сұрақ KK",
            "options_ru": '["Ответ 1", "Ответ 2"]',
            "options_kk": '["Жауап 1"]',
            "correct_option_index": "0",
        },
    )

    assert response.status_code == 422
    assert "одинаковое их количество" in response.json()["detail"]