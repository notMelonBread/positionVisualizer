#include <unity.h>
#include <ArduinoFake.h>
#include "../../src/core/Calibration.h"

using namespace fakeit;

void setUp(void)
{
    ArduinoFake().Reset();
}

void tearDown(void)
{
    // 各テスト後のクリーンアップ
}

void test_map_to_0_100(void)
{
    Calibration calibration;

    // キャリブレーション値を設定（EEPROMはモック化）
    When(Method(ArduinoFake(), EEPROM_put)).AlwaysReturn();
    When(Method(ArduinoFake(), EEPROM_get)).AlwaysReturn();

    calibration.saveCalibration(0, 1023, true);

    // 最小値、中間値、最大値のテスト
    TEST_ASSERT_EQUAL_INT(0, calibration.mapTo0_100(0));
    TEST_ASSERT_EQUAL_INT(50, calibration.mapTo0_100(512));
    TEST_ASSERT_EQUAL_INT(100, calibration.mapTo0_100(1023));

    // エッジケース
    TEST_ASSERT_EQUAL_INT(0, calibration.mapTo0_100(-100));   // 下限以下は0
    TEST_ASSERT_EQUAL_INT(100, calibration.mapTo0_100(2000)); // 上限以上は100
}

void test_is_valid_range(void)
{
    Calibration calibration;

    // 有効な範囲
    TEST_ASSERT_TRUE(calibration.isValidRange(0, 1023));
    TEST_ASSERT_TRUE(calibration.isValidRange(100, 900));

    // 無効な範囲（最小値 > 最大値）
    TEST_ASSERT_FALSE(calibration.isValidRange(1023, 0));
    TEST_ASSERT_FALSE(calibration.isValidRange(500, 100));

    // 無効な範囲（範囲が狭すぎる）
    TEST_ASSERT_FALSE(calibration.isValidRange(500, 520)); // 20の差は小さすぎる
    TEST_ASSERT_FALSE(calibration.isValidRange(0, 10));    // 10の差は小さすぎる
}

void test_save_load_calibration(void)
{
    Calibration calibration;

    // EEPROMアクセスをモック化
    When(Method(ArduinoFake(), EEPROM_put)).AlwaysReturn();
    When(Method(ArduinoFake(), EEPROM_get)).AlwaysReturn();

    // 保存テスト
    TEST_ASSERT_TRUE(calibration.saveCalibration(100, 900, true));

    // 保存操作の検証
    Verify(Method(ArduinoFake(), EEPROM_put)).AtLeastOnce();

    // 読み込みテスト
    int min = 0, max = 0;
    bool isCalibrated = false;

    // ダミーデータをセット
    When(Method(ArduinoFake(), EEPROM_get)).Do([&](uint16_t addr, CalibrationData &data)
                                               {
        data.minValue = 100;
        data.maxValue = 900;
        data.isCalibrated = true;
        data.checksum = 0; // 実際のチェックサムはCalibratioin.cppの実装に依存
        return true; });

    bool loadResult = calibration.loadCalibration(min, max, isCalibrated);
    TEST_ASSERT_TRUE(loadResult);
    TEST_ASSERT_EQUAL_INT(100, min);
    TEST_ASSERT_EQUAL_INT(900, max);
    TEST_ASSERT_TRUE(isCalibrated);

    // 読み込み操作の検証
    Verify(Method(ArduinoFake(), EEPROM_get)).AtLeastOnce();
}

void test_reset_calibration(void)
{
    Calibration calibration;

    // EEPROMアクセスをモック化
    When(Method(ArduinoFake(), EEPROM_put)).AlwaysReturn();

    // リセットテスト
    calibration.resetCalibration();

    // リセット後の状態を検証
    int min = 0, max = 0;
    bool isCalibrated = true; // リセット前はtrueと仮定

    // ダミーデータをセット
    When(Method(ArduinoFake(), EEPROM_get)).Do([&](uint16_t addr, CalibrationData &data)
                                               {
        data.minValue = 0;
        data.maxValue = 1023;
        data.isCalibrated = false;
        data.checksum = 0; // 実際のチェックサムはCalibratioin.cppの実装に依存
        return true; });

    calibration.loadCalibration(min, max, isCalibrated);

    TEST_ASSERT_EQUAL_INT(0, min);
    TEST_ASSERT_EQUAL_INT(1023, max);
    TEST_ASSERT_FALSE(isCalibrated);

    // リセット操作の検証
    Verify(Method(ArduinoFake(), EEPROM_put)).AtLeastOnce();
}

int main(void)
{
    UNITY_BEGIN();

    RUN_TEST(test_map_to_0_100);
    RUN_TEST(test_is_valid_range);
    RUN_TEST(test_save_load_calibration);
    RUN_TEST(test_reset_calibration);

    return UNITY_END();
}