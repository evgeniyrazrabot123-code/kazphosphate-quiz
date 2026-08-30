from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_specialties_are_translated_to_kazakh():
    response = client.get('/api/specialties?lang=kk')
    assert response.status_code == 200
    data = response.json()
    assert data['car_driver'] == 'Жеңіл автомобиль жүргізушісі'
    assert data['dumper'] == 'Карьерлік самосвал жүргізушісі'
